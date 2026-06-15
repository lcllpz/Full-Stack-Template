import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { authConfigKey } from '@/config/auth/config';
import { AllConfigType } from '@/config/config.type';
import { SessionService } from '@/session/session.service';

// 自定义 JWT 策略
//  JWT 签名与过期校验
// 守卫：用于保护路由，只有通过 JWT 验证的用户才能访问该路由
// 策略：用于验证 JWT 令牌
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // 过期 token 会被拒绝
      secretOrKey: configService.getOrThrow(authConfigKey, {
        infer: true,
      }).JWT_SECRET,
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
