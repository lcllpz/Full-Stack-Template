import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { SkipPermissions } from '@/permission/permissions.decorator';
import { SWAGGER_REFRESH_AUTH } from '@/swagger/swagger.constants';
import { THROTTLE_LIMIT_AUTH, THROTTLE_TTL_MS } from '@/throttle/throttle.constants';
import { User } from '@/user/entities/user.entity';

import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { Public } from './guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthService } from './auth.service';

@ApiTags('认证')
@SkipPermissions()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 注册
  // 1. 验证用户是否被创建： 邮箱是否被注册
  // 2. 创建用户：password 加盐加密存储到数据库
  // 3. 返回成功
  @Post('register')
  @Public()
  // 文档：Swagger UI 不要求 token
  @ApiOperation({ security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  register(@Body() registerDto: AuthRegisterLoginDto) {
    return this.authService.register(registerDto);
  }

  // 登录
  // 1. LocalAuthGuard + LocalStrategy：验证邮箱与密码，写入 req.user
  // 2. 创建 session： 生成 sessionId 和 hash
  // 3. 生成 token 和 refreshToken
  // 4. 返回 token 和 refreshToken
  @Post('login')
  @Public()
  @ApiOperation({ security: [] })
  @ApiBody({ type: AuthLoginDto })
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  login(@Request() request: { user: Omit<User, 'password'> }) {
    return this.authService.login(request.user);
  }

  // 刷新 token
  // 1. 验证会话是否存在: sessionId、deletedAt
  // 2. 验证会话哈希是否匹配: hash
  // 3. 更新session的hash并生成新的 token 和 refreshToken
  // 4. 返回新的 token 和 refreshToken
  @Post('refresh')
  @Public()
  @ApiBearerAuth(SWAGGER_REFRESH_AUTH)
  @ApiOperation({ security: [{ [SWAGGER_REFRESH_AUTH]: [] }] })
  @UseGuards(JwtRefreshAuthGuard)
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
  logout(@Request() request: Request & { user: { sessionId: string } }) {
    const sessionId = request.user.sessionId;
    return this.authService.logout(sessionId);
  }

  // 获取当前用户信息 + 权限码 + 可见菜单树
  @Get('me')
  getMe(@Request() request: Request & { user: { userId: string } }) {
    return this.authService.getMe(request.user.userId);
  }
}
