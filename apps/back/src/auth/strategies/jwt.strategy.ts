import { HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { SessionService } from '@/session/session.service';

// 自定义 JWT 策略
// 用于验证 JWT 令牌
// 在请求头中提取 JWT 令牌
// 忽略过期时间
// 使用 secret 密钥验证 JWT 令牌
// 返回用户信息
// 守卫：用于保护路由，只有通过 JWT 验证的用户才能访问该路由
// 策略：用于验证 JWT 令牌
// 策略：用于保护路由，只有通过 JWT 验证的用户才能访问该路由
// 策略：用于验证 JWT 令牌

//  JWT 签名与过期校验
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  @Inject(SessionService)
  private sessionService: SessionService;

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // 过期 token 会被拒绝
      secretOrKey: 'secret',
    });
  }
  //   请求带 Authorization: Bearer <token>
  //   → AuthGuard('jwt') 触发 JwtStrategy
  //   → JWT 验签成功，得到 payload
  //   → 调用 validate(payload)
  //   → validate 的返回值 → 写入 req.user: @Request() request
  //   → 进入 Controller 方法
  async validate(payload: { sessionId: string }) {
    const session = await this.sessionService.findValidById(payload.sessionId);
    if (!session) {
      throw new UnauthorizedException({
        message: '会话已过期',
        status: HttpStatus.UNAUTHORIZED,
      }); // 或 ForbiddenException
    }
    return { ...payload };
  }
}
