import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 触发 passport-jwtRefresh 流程，验证 refresh token 并写入 req.user */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwtRefresh') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    // _info: Error | undefined
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Refresh token 无效或已过期');
    }
    return user;
  }
}
