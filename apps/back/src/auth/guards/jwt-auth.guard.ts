import { ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

/** 全局 JWT 守卫 metadata key，供 PermissionsGuard 等读取 */
export const IS_PUBLIC_KEY = 'isPublic';

/** 标记无需 JWT 鉴权的路由（注册、登录、刷新 token 等） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// 触发 passport-jwt 流程，验证通过后写入 req.user
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      // 提取当前正在处理的路由处理器对应的元数据
      context.getHandler(),
      // 获取控制器层面应用元数据
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    console.log('jwt守卫验证');
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    // _info: Error | undefined
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('未授权，请先登录');
    }
    return user;
  }
}
