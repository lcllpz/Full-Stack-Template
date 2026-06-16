import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserService } from '@/user/user.service';

import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取装饰器Permissions设置的值
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
    if (roleNames.includes('super_admin')) return true;

    // 查询用户所有 BUTTON 类型菜单的 code 集合
    const userCodes = await this.userService.getPermissionCodes(user.userId);
    return requiredCodes.every((code) => userCodes.includes(code));
    // 403 表示「我知道你是谁，但你不允许做这件事」
    // 401 表示「我不知道你是谁，或你的凭证无效」
  }
}
