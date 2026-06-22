import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';

import { THROTTLE_LIMIT_AUTH, THROTTLE_TTL_MS } from '@/throttle/throttle.constants';
import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 注册
  // 1. 验证用户是否被创建： 邮箱是否被注册
  // 2. 创建用户：password 加盐加密存储到数据库
  // 3. 返回成功
  @Post('register')
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  register(@Body() registerDto: AuthRegisterLoginDto) {
    return this.authService.register(registerDto);
  }

  // 登录
  // 1. 验证用户是否存在： 邮箱是否被注册
  // 2. 验证用户密码是否正确： 密码是否与数据库中的密码匹配
  // 3. 创建 session： 生成 sessionId 和 hash
  // 4. 生成 token 和 refreshToken
  // 4. 返回 token 和 refreshToken
  @Post('login')
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  login(@Body() loginDto: UserRegistrationFieldsDto) {
    return this.authService.login(loginDto);
  }

  // 刷新 token
  // 1. 验证会话是否存在: sessionId、deletedAt
  // 2. 验证会话哈希是否匹配: hash
  // 3. 更新session的hash并生成新的 token 和 refreshToken
  // 4. 返回新的 token 和 refreshToken
  @Post('refresh')
  @UseGuards(AuthGuard('jwtRefresh'))
  refresh(@Request() request) {
    const sessionId = request.user.sessionId;
    const userId = request.user.userId;
    return this.authService.refreshToken({
      sessionId,
      userId,
    });
  }

  // 退出登录
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Request() request: Request & { user: { sessionId: string } }) {
    const sessionId = request.user.sessionId;
    return this.authService.logout(sessionId);
  }

  // 获取当前用户信息 + 权限码 + 可见菜单树
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Request() request: Request & { user: { userId: string } }) {
    return this.authService.getMe(request.user.userId);
  }
}
