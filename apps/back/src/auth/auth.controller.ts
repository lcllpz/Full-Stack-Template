import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { SkipPermissions } from '@/permission/permissions.decorator';
import { SWAGGER_REFRESH_AUTH } from '@/swagger/swagger.constants';
import { THROTTLE_LIMIT_AUTH, THROTTLE_TTL_MS } from '@/throttle/throttle.constants';
import { User } from '@/user/entities/user.entity';

import { BindPhoneDto } from './dto/bind-phone.dto';
import { CaptchaFieldsDto } from './dto/captcha-fields.dto';
import { EmailCodeLoginDto } from './dto/email-code-login.dto';
import { EmailPasswordLoginDto } from './dto/email-password-login.dto';
import { EmailPasswordRegisterDto } from './dto/email-password-register.dto';
import { PhoneCodeLoginDto } from './dto/phone-code-login.dto';
import { RebindEmailConfirmDto, RebindEmailNewCodeDto } from './dto/rebind-email.dto';
import { RebindPhoneConfirmDto, RebindPhoneNewCodeDto } from './dto/rebind-phone.dto';
import { ResetPasswordByEmailDto } from './dto/reset-password-by-email.dto';
import { ResetPasswordByPasswordDto } from './dto/reset-password-by-password.dto';
import { ResetPasswordByPhoneDto } from './dto/reset-password-by-phone.dto';
import { SendEmailCodeDto } from './dto/send-email-code.dto';
import { SendPhoneCodeDto } from './dto/send-phone-code.dto';
import { Public } from './guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthService } from './auth.service';

@ApiTags('认证')
@SkipPermissions()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 注册第一步：发送邮箱验证码
  // 1. 校验图形验证码（防刷）
  // 2. 校验邮箱未被占用
  // 3. 生成验证码入库(Redis) 并入队异步发送邮件
  @Post('register/send-code')
  @Public()
  @ApiOperation({ summary: '注册-发送邮箱验证码', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendRegisterCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendRegisterCode(dto);
  }

  // 注册第二步：校验验证码并建号
  // 1. 校验邮箱验证码（注册场景，一次性）
  // 2. 创建用户：password 加盐加密存储，直接激活（ACTIVE + emailVerified）
  // 3. 返回成功
  @Post('register')
  @Public()
  // 文档：Swagger UI 不要求 token
  @ApiOperation({ summary: '注册-提交', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  register(@Body() registerDto: EmailPasswordRegisterDto) {
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
  @ApiBody({ type: EmailPasswordLoginDto })
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  login(@Request() request: { user: Omit<User, 'password'> }) {
    return this.authService.login(request.user);
  }

  // 邮箱验证码登录-发码
  @Post('login/email/send-code')
  @Public()
  @ApiOperation({ summary: '邮箱验证码登录-发送验证码', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendLoginEmailCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendLoginEmailCode(dto);
  }

  // 邮箱验证码登录
  @Post('login/email')
  @Public()
  @ApiOperation({ summary: '邮箱验证码登录', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  loginByEmailCode(@Body() dto: EmailCodeLoginDto) {
    return this.authService.loginByEmailCode(dto);
  }

  // 手机验证码登录-发码
  @Post('login/phone/send-code')
  @Public()
  @ApiOperation({ summary: '手机验证码登录-发送验证码', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendLoginPhoneCode(@Body() dto: SendPhoneCodeDto) {
    return this.authService.sendLoginPhoneCode(dto);
  }

  // 手机验证码登录
  @Post('login/phone')
  @Public()
  @ApiOperation({ summary: '手机验证码登录', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  loginByPhoneCode(@Body() dto: PhoneCodeLoginDto) {
    return this.authService.loginByPhoneCode(dto);
  }

  // ─── 设置新密码（三渠道，均无需登录态）────────────────────

  // 渠道A：账号 + 旧密码
  @Post('password/reset/by-password')
  @Public()
  @ApiOperation({ summary: '重置密码-旧密码方式', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  resetPasswordByOldPassword(@Body() dto: ResetPasswordByPasswordDto) {
    return this.authService.resetPasswordByOldPassword(dto);
  }

  // 渠道C：邮箱验证码
  @Post('password/reset/email/send-code')
  @Public()
  @ApiOperation({ summary: '重置密码-发邮箱验证码', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendResetPasswordEmailCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendResetPasswordEmailCode(dto);
  }

  @Post('password/reset/email')
  @Public()
  @ApiOperation({ summary: '重置密码-邮箱验证码方式', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  resetPasswordByEmail(@Body() dto: ResetPasswordByEmailDto) {
    return this.authService.resetPasswordByEmail(dto);
  }

  // 渠道B：手机验证码
  @Post('password/reset/phone/send-code')
  @Public()
  @ApiOperation({ summary: '重置密码-发手机验证码', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendResetPasswordPhoneCode(@Body() dto: SendPhoneCodeDto) {
    return this.authService.sendResetPasswordPhoneCode(dto);
  }

  @Post('password/reset/phone')
  @Public()
  @ApiOperation({ summary: '重置密码-手机验证码方式', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  resetPasswordByPhone(@Body() dto: ResetPasswordByPhoneDto) {
    return this.authService.resetPasswordByPhone(dto);
  }

  // ─── 绑定手机（需登录）────────────────────────────────────

  @Post('phone/bind/send-code')
  @ApiOperation({ summary: '绑定手机-发送验证码' })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendBindPhoneCode(@Body() dto: SendPhoneCodeDto) {
    return this.authService.sendBindPhoneCode(dto);
  }

  @Post('phone/bind')
  @ApiOperation({ summary: '绑定手机' })
  bindPhone(@Request() request: { user: { userId: string } }, @Body() dto: BindPhoneDto) {
    return this.authService.bindPhone(request.user.userId, dto);
  }

  // ─── 换绑邮箱（需登录，双重验证）──────────────────────────

  @Post('email/rebind/send-old-code')
  @ApiOperation({ summary: '换绑邮箱-向原邮箱发码' })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendRebindEmailOldCode(
    @Request() request: { user: { userId: string } },
    @Body() dto: CaptchaFieldsDto,
  ) {
    return this.authService.sendRebindEmailOldCode(request.user.userId, dto);
  }

  @Post('email/rebind/send-new-code')
  @ApiOperation({ summary: '换绑邮箱-验旧身份并向新邮箱发码' })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendRebindEmailNewCode(@Body() dto: RebindEmailNewCodeDto) {
    return this.authService.sendRebindEmailNewCode(dto);
  }

  @Post('email/rebind/confirm')
  @ApiOperation({ summary: '换绑邮箱-确认' })
  confirmRebindEmail(
    @Request() request: { user: { userId: string } },
    @Body() dto: RebindEmailConfirmDto,
  ) {
    return this.authService.confirmRebindEmail(request.user.userId, dto);
  }

  // ─── 换绑手机（需登录，双重验证）──────────────────────────

  @Post('phone/rebind/send-old-code')
  @ApiOperation({ summary: '换绑手机-向原手机发码' })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendRebindPhoneOldCode(
    @Request() request: { user: { userId: string } },
    @Body() dto: CaptchaFieldsDto,
  ) {
    return this.authService.sendRebindPhoneOldCode(request.user.userId, dto);
  }

  @Post('phone/rebind/send-new-code')
  @ApiOperation({ summary: '换绑手机-验旧身份并向新手机发码' })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  sendRebindPhoneNewCode(@Body() dto: RebindPhoneNewCodeDto) {
    return this.authService.sendRebindPhoneNewCode(dto);
  }

  @Post('phone/rebind/confirm')
  @ApiOperation({ summary: '换绑手机-确认' })
  confirmRebindPhone(
    @Request() request: { user: { userId: string } },
    @Body() dto: RebindPhoneConfirmDto,
  ) {
    return this.authService.confirmRebindPhone(request.user.userId, dto);
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
