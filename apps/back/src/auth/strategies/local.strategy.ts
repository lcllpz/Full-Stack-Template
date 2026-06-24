import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth.service';

// Passport local 策略：将邮箱密码登录流程规范化
// 请求体 email/password → LocalAuthGuard → validate() → req.user
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // passport-local 默认字段为 username，此处用 email 作为登录标识
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    console.log('登录策略验证');
    return this.authService.validateUser(email, password);
  }
}
