import { HttpStatus, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { authConfigKey } from '@/config/auth/config';
import { AllConfigType } from '@/config/config.type';

import { AuthService } from '../auth.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwtRefresh') {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow(authConfigKey, {
        infer: true,
      }).JWT_REFRESH_SECRET,
    });
  }
  async validate(payload: { hash: string; sessionId: string }) {
    // 1. 验证会话是否存在: sessionId、deletedAt
    // 2. 验证会话哈希是否匹配: hash
    // 3. 更新session的hash并生成新的 token 和 refreshToken
    // 4. 返回新的 token 和 refreshToken
    const { hash, sessionId } = payload;
    if (!hash || !sessionId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          sessionId: 'Refresh token is invalid',
        },
      });
    }
    await this.authService.validateRefreshToken({ sessionId, hash });
    return payload;
  }
}
