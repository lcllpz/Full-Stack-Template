import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: AuthRegisterLoginDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: UserRegistrationFieldsDto) {
    return this.authService.login(loginDto);
  }

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
  // 1. 软删除 session、  refreshToken无法获取新token
  // 2. 返回成功
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Request() request: Request & { user: { sessionId: string } }) {
    const sessionId = request.user.sessionId;
    return this.authService.logout(sessionId);
  }
}
