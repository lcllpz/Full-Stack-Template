import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@/auth/guards/jwt-auth.guard';
import { AllConfigType } from '@/config/config.type';
import { seedsConfigKey } from '@/config/seeds/config';
import { UserService } from '@/user/user.service';

import { PERMISSIONS_KEY, SKIP_PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipPermissions = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipPermissions) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    console.log('权限、菜单守卫验证');

    // 获取装饰器 Permissions 设置的值
    const requiredCodes = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 未标注 @Permissions() 则放行
    if (!requiredCodes?.length) return true;

    // 获取的是当前 HTTP 请求的 Express Request 对象，包含本次请求的所有原始信息。
    const { user } = context.switchToHttp().getRequest<{ user: { userId: string } }>();

    // super_admin 角色直接豁免所有权限校验
    const info = await this.userService.findOne(user.userId);

    const roleNames: string[] = (info.roles ?? []).map((r: { name: string }) => r.name);
    const { SUPER_ADMIN_ROLE_NAME } = this.configService.getOrThrow(seedsConfigKey, {
      infer: true,
    });
    if (roleNames.includes(SUPER_ADMIN_ROLE_NAME)) return true;

    // 查询用户所有 BUTTON 类型菜单的 code 集合
    const userCodes = await this.userService.getPermissionCodes(user.userId);
    const allowed = requiredCodes.every((code) => userCodes.includes(code));
    if (!allowed) {
      // 403 表示「我知道你是谁，但你不允许做这件事」
      throw new ForbiddenException('权限不足，无法访问该资源');
    }
    return true;
  }
}
