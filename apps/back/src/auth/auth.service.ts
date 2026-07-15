import { HttpStatus, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { CaptchaService } from '@/captcha/captcha.service';
import { authConfigKey } from '@/config/auth/config';
import { AllConfigType } from '@/config/config.type';
import { NotificationService } from '@/queue/notification.service';
import { Session } from '@/session/entities/session.entity';
import { SessionService } from '@/session/session.service';
import { User, UserStatus } from '@/user/entities/user.entity';
import { UserService } from '@/user/user.service';
import { VerifyScene } from '@/verification/verification.constants';
import { VerificationService } from '@/verification/verification.service';

import { BindPhoneDto } from './dto/bind-phone.dto';
import { CaptchaFieldsDto } from './dto/captcha-fields.dto';
import { EmailCodeLoginDto } from './dto/email-code-login.dto';
import { EmailPasswordRegisterDto } from './dto/email-password-register.dto';
import { PhoneCodeLoginDto } from './dto/phone-code-login.dto';
import { RebindEmailConfirmDto, RebindEmailNewCodeDto } from './dto/rebind-email.dto';
import { RebindPhoneConfirmDto, RebindPhoneNewCodeDto } from './dto/rebind-phone.dto';
import { ResetPasswordByEmailDto } from './dto/reset-password-by-email.dto';
import { ResetPasswordByPasswordDto } from './dto/reset-password-by-password.dto';
import { ResetPasswordByPhoneDto } from './dto/reset-password-by-phone.dto';
import { SendEmailCodeDto } from './dto/send-email-code.dto';
import { SendPhoneCodeDto } from './dto/send-phone-code.dto';
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}
  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(SessionService)
  private readonly sessionService: SessionService;

  @Inject(ConfigService)
  private readonly configService: ConfigService<AllConfigType>;

  @Inject(CaptchaService)
  private readonly captchaService: CaptchaService;

  @Inject(VerificationService)
  private readonly verificationService: VerificationService;

  @Inject(NotificationService)
  private readonly notificationService: NotificationService;

  /**
   * 注册第一步：校验图形验证码 + 邮箱未被占用 → 生成并异步发送邮箱验证码。
   */
  async sendRegisterCode(dto: SendEmailCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);

    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱已注册' },
      });
    }

    const code = await this.verificationService.issueCode(VerifyScene.REGISTER, dto.email);
    await this.notificationService.enqueueEmailCode(dto.email, code, '注册验证码');

    return {
      status: HttpStatus.OK,
      message: '验证码已发送',
    };
  }

  /**
   * 注册第二步：校验邮箱验证码通过后创建用户，直接激活（ACTIVE + emailVerified）。
   */
  async register(registerDto: EmailPasswordRegisterDto) {
    const existing = await this.userService.findByEmail(registerDto.email);
    if (existing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱已注册' },
      });
    }

    // 校验注册场景验证码（成功即一次性消费）
    await this.verificationService.verifyCode(
      VerifyScene.REGISTER,
      registerDto.email,
      registerDto.code,
    );

    await this.userService.create(registerDto, {
      status: UserStatus.ACTIVE,
      emailVerified: true,
    });

    return {
      status: HttpStatus.CREATED,
      message: '注册成功',
    };
  }

  // ─── 验证码登录 ──────────────────────────────────────────

  /** 邮箱验证码登录-发码：校验图形码 + 邮箱已注册 → 发送登录验证码 */
  async sendLoginEmailCode(dto: SendEmailCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱未注册' },
      });
    }

    const code = await this.verificationService.issueCode(VerifyScene.LOGIN_EMAIL, dto.email);
    await this.notificationService.enqueueEmailCode(dto.email, code, '登录验证码');

    return { status: HttpStatus.OK, message: '验证码已发送' };
  }

  /** 邮箱验证码登录：校验验证码 → 签发会话与 token */
  async loginByEmailCode(dto: EmailCodeLoginDto) {
    await this.verificationService.verifyCode(VerifyScene.LOGIN_EMAIL, dto.email, dto.code);

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱未注册' },
      });
    }

    return this.login(this.stripPassword(user));
  }

  /** 手机验证码登录-发码：校验图形码 + 手机已注册 → 发送登录验证码 */
  async sendLoginPhoneCode(dto: SendPhoneCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);

    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phone: '该手机号未注册' },
      });
    }

    const code = await this.verificationService.issueCode(VerifyScene.LOGIN_PHONE, dto.phone);
    await this.notificationService.enqueueSmsCode(dto.phone, code, '登录验证码');

    return { status: HttpStatus.OK, message: '验证码已发送' };
  }

  /** 手机验证码登录：校验验证码 → 签发会话与 token */
  async loginByPhoneCode(dto: PhoneCodeLoginDto) {
    await this.verificationService.verifyCode(VerifyScene.LOGIN_PHONE, dto.phone, dto.code);

    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phone: '该手机号未注册' },
      });
    }

    return this.login(this.stripPassword(user));
  }

  // ─── 设置新密码（三渠道） ────────────────────────────────

  /** 渠道A：账号(邮箱) + 旧密码 → 设新密码 */
  async resetPasswordByOldPassword(dto: ResetPasswordByPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);
    // 用同样规则再哈希一次，看结果是否一致
    if (!user || !(await bcrypt.compare(dto.oldPassword, user.password))) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { password: '账号或旧密码错误' },
      });
    }
    await this.userService.updatePassword(user.id, dto.newPassword);
    await this.sessionService.invalidateAllForUser(user.id);
    return { status: HttpStatus.OK, message: '密码修改成功，请重新登录' };
  }

  /** 渠道C：忘记密码-发邮箱验证码 */
  async sendResetPasswordEmailCode(dto: SendEmailCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱未注册' },
      });
    }
    const code = await this.verificationService.issueCode(VerifyScene.RESET_PWD_EMAIL, dto.email);
    await this.notificationService.enqueueEmailCode(dto.email, code, '重置密码验证码');
    return { status: HttpStatus.OK, message: '验证码已发送' };
  }

  /** 渠道C：邮箱验证码 → 设新密码 */
  async resetPasswordByEmail(dto: ResetPasswordByEmailDto) {
    await this.verificationService.verifyCode(VerifyScene.RESET_PWD_EMAIL, dto.email, dto.code);
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱未注册' },
      });
    }
    await this.userService.updatePassword(user.id, dto.newPassword);
    await this.sessionService.invalidateAllForUser(user.id);
    return { status: HttpStatus.OK, message: '密码重置成功，请重新登录' };
  }

  /** 渠道B：忘记密码-发手机验证码 */
  async sendResetPasswordPhoneCode(dto: SendPhoneCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);
    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phone: '该手机号未注册' },
      });
    }
    const code = await this.verificationService.issueCode(VerifyScene.RESET_PWD_PHONE, dto.phone);
    await this.notificationService.enqueueSmsCode(dto.phone, code, '重置密码验证码');
    return { status: HttpStatus.OK, message: '验证码已发送' };
  }

  /** 渠道B：手机验证码 → 设新密码 */
  async resetPasswordByPhone(dto: ResetPasswordByPhoneDto) {
    await this.verificationService.verifyCode(VerifyScene.RESET_PWD_PHONE, dto.phone, dto.code);
    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phone: '该手机号未注册' },
      });
    }
    await this.userService.updatePassword(user.id, dto.newPassword);
    await this.sessionService.invalidateAllForUser(user.id);
    return { status: HttpStatus.OK, message: '密码重置成功，请重新登录' };
  }

  // ─── 绑定手机 ────────────────────────────────────────────

  /** 绑定手机-发码：校验图形码 + 手机未被占用 */
  async sendBindPhoneCode(dto: SendPhoneCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);
    await this.assertPhoneAvailable(dto.phone);
    const code = await this.verificationService.issueCode(VerifyScene.BIND_PHONE, dto.phone);
    await this.notificationService.enqueueSmsCode(dto.phone, code, '绑定手机验证码');
    return { status: HttpStatus.OK, message: '验证码已发送' };
  }

  /** 绑定手机：校验验证码 → 写入手机号并标记已验证 */
  async bindPhone(userId: string, dto: BindPhoneDto) {
    await this.assertPhoneAvailable(dto.phone, userId);
    await this.verificationService.verifyCode(VerifyScene.BIND_PHONE, dto.phone, dto.code);
    await this.userService.setPhone(userId, dto.phone);
    return { status: HttpStatus.OK, message: '手机绑定成功' };
  }

  // ─── 换绑邮箱（双重验证） ─────────────────────────────────

  /** 换绑邮箱-第一步：向当前邮箱发验证码（验旧身份方式①） */
  async sendRebindEmailOldCode(userId: string, dto: CaptchaFieldsDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);
    const user = await this.userService.findOne(userId);
    if (!user.email) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '当前账号未绑定邮箱' },
      });
    }
    const code = await this.verificationService.issueCode(VerifyScene.REBIND_EMAIL_OLD, user.email);
    await this.notificationService.enqueueEmailCode(user.email, code, '换绑验证码(原邮箱)');
    return { status: HttpStatus.OK, message: '验证码已发送至原邮箱' };
  }

  /** 换绑邮箱-第二步：校验旧身份(旧码/密码) → 向新邮箱发码 */
  // 第一步可以是邮箱加密码/邮箱加验证码
  async sendRebindEmailNewCode(dto: RebindEmailNewCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);

    await this.assertEmailAvailable(dto.newEmail);
    const code = await this.verificationService.issueCode(
      VerifyScene.REBIND_EMAIL_NEW,
      dto.newEmail,
    );
    await this.notificationService.enqueueEmailCode(dto.newEmail, code, '换绑验证码(新邮箱)');
    return { status: HttpStatus.OK, message: '验证码已发送至新邮箱' };
  }

  /** 换绑邮箱-第三步：校验新邮箱验证码 → 完成换绑 */
  async confirmRebindEmail(userId: string, dto: RebindEmailConfirmDto) {
    const user = await this.userService.findOne(userId);

    // 校验身份
    await this.verifyOldIdentity({
      user,
      scene: VerifyScene.REBIND_EMAIL_OLD,
      target: user.email,
      oldCode: dto.oldCode,
      password: dto.password,
    });

    await this.assertEmailAvailable(dto.newEmail, userId);
    await this.verificationService.verifyCode(
      VerifyScene.REBIND_EMAIL_NEW,
      dto.newEmail,
      dto.newCode,
    );
    await this.userService.setEmail(userId, dto.newEmail);
    return { status: HttpStatus.OK, message: '邮箱换绑成功' };
  }

  // ─── 换绑手机（双重验证） ─────────────────────────────────

  /** 换绑手机-第一步：向当前手机发验证码（验旧身份方式①） */
  async sendRebindPhoneOldCode(userId: string, dto: CaptchaFieldsDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);
    const user = await this.userService.findOne(userId);
    if (!user.phone) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phone: '当前账号未绑定手机' },
      });
    }
    const code = await this.verificationService.issueCode(VerifyScene.REBIND_PHONE_OLD, user.phone);
    await this.notificationService.enqueueSmsCode(user.phone, code, '换绑验证码(原手机)');
    return { status: HttpStatus.OK, message: '验证码已发送至原手机' };
  }

  /** 换绑手机-第二步：校验旧身份(旧码/密码) → 向新手机发码 */
  async sendRebindPhoneNewCode(dto: RebindPhoneNewCodeDto) {
    await this.assertCaptcha(dto.captchaId, dto.captchaText);
    await this.assertPhoneAvailable(dto.newPhone);
    const code = await this.verificationService.issueCode(
      VerifyScene.REBIND_PHONE_NEW,
      dto.newPhone,
    );
    await this.notificationService.enqueueSmsCode(dto.newPhone, code, '换绑验证码(新手机)');
    return { status: HttpStatus.OK, message: '验证码已发送至新手机' };
  }

  /** 换绑手机-第三步：校验新手机验证码 → 完成换绑 */
  async confirmRebindPhone(userId: string, dto: RebindPhoneConfirmDto) {
    await this.assertPhoneAvailable(dto.newPhone, userId);
    const user = await this.userService.findOne(userId);
    await this.verifyOldIdentity({
      user,
      scene: VerifyScene.REBIND_PHONE_OLD,
      target: user.phone,
      oldCode: dto.oldCode,
      password: dto.password,
    });
    await this.verificationService.verifyCode(
      VerifyScene.REBIND_PHONE_NEW,
      dto.newPhone,
      dto.newCode,
    );
    await this.userService.setPhone(userId, dto.newPhone);
    return { status: HttpStatus.OK, message: '手机换绑成功' };
  }

  // ─── 私有辅助 ────────────────────────────────────────────

  /**
   * 校验「旧身份」：登录密码 或 旧渠道验证码，二选一，至少提供一个。
   * 用于换绑邮箱/手机的第一重验证，防止他人盗用登录态劫持账号。
   */
  private async verifyOldIdentity(params: {
    user: User;
    scene: VerifyScene;
    target: string | null;
    oldCode?: string;
    password?: string;
  }): Promise<void> {
    const { user, scene, target, oldCode, password } = params;
    console.log('verifyOldIdentity->>>>>>>>>>>>>>>>>>>>', params);
    if (password) {
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { password: '登录密码错误' },
        });
      }
      return;
    }

    if (oldCode) {
      if (!target) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { oldCode: '当前账号未绑定该渠道，无法用旧验证码验证' },
        });
      }
      await this.verificationService.verifyCode(scene, target, oldCode);
      return;
    }

    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { oldIdentity: '请提供旧验证码或登录密码以验证身份' },
    });
  }

  /** 确保邮箱未被他人占用（userId 传入时排除自身） */
  private async assertEmailAvailable(email: string, selfUserId?: string): Promise<void> {
    const existing = await this.userService.findByEmail(email);
    if (existing && existing.id !== selfUserId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: '该邮箱已被占用' },
      });
    }
  }

  /** 确保手机号未被他人占用（userId 传入时排除自身） */
  private async assertPhoneAvailable(phone: string, selfUserId?: string): Promise<void> {
    const existing = await this.userService.findByPhone(phone);
    if (existing && existing.id !== selfUserId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phone: '该手机号已被占用' },
      });
    }
  }

  /** 剥离 password 字段，得到可对外的用户对象 */
  private stripPassword(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 剥离 password 字段
    const { password: _password, ...result } = user;
    return result;
  }

  /** 校验图形验证码，不通过统一抛 422（errors.captcha） */
  private async assertCaptcha(captchaId: string, captchaText: string): Promise<void> {
    const ok = await this.captchaService.verify(captchaId, captchaText);
    if (!ok) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { captcha: '图形验证码错误或已过期' },
      });
    }
  }

  /** LocalStrategy 校验凭证：查用户、比对密码，成功则返回不含 password 的用户 */
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'>> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: '账号密码错误',
        },
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: '账号密码错误',
        },
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 剥离 password 字段
    const { password: _password, ...result } = user;
    return result;
  }

  /** 凭证已通过 LocalStrategy 校验，创建 session 并签发 token */
  async login(user: Omit<User, 'password'>) {
    const session = await this.sessionService.createForUser(user.id);
    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      userId: user.id,
      sessionId: session.id,
      hash: session.hash,
    });

    return {
      user,
      token,
      refreshToken,
      tokenExpires,
    };
  }

  private async getTokensData(data: {
    userId: User['id'];
    sessionId: Session['id'];
    hash: Session['hash'];
    // role: Role['name'],
  }) {
    const payload = {
      userId: data.userId,
      // role: data.role,
      sessionId: data.sessionId,
    };

    const { JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } =
      this.configService.getOrThrow(authConfigKey, {
        infer: true,
      });
    const tokenExpires = JWT_EXPIRES_IN;
    const refreshTokenExpires = JWT_REFRESH_EXPIRES_IN;
    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: tokenExpires,
        secret: JWT_SECRET,
      }),
      this.jwtService.signAsync(
        {
          ...payload,
          hash: data.hash,
        },
        {
          expiresIn: refreshTokenExpires,
          secret: JWT_REFRESH_SECRET,
        },
      ),
    ]);
    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async validateRefreshToken(data: { sessionId: Session['id']; hash: Session['hash'] }) {
    const session = await this.sessionService.findValidById(data.sessionId);
    if (!session || session.deletedAt) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          sessionId: '会话已过期',
        },
      });
    }
    if (session.hash !== data.hash) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: '会话哈希不匹配',
        },
      });
    }
  }

  async refreshToken(data: { sessionId: Session['id']; userId: User['id'] }) {
    const hash = randomBytes(32).toString('hex');
    await this.sessionService.updateHash(data.sessionId, hash);
    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      userId: data.userId,
      sessionId: data.sessionId,
      hash,
    });
    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async logout(sessionId: Session['id']) {
    await this.sessionService.invalidate(sessionId);
    return {
      status: HttpStatus.OK,
      message: '退出成功',
    };
  }

  /** GET /auth/me —— 返回当前用户信息 + 权限码 + 可见菜单树 */
  async getMe(userId: string) {
    const [user, permissions, menus, roles] = await Promise.all([
      this.userService.findOne(userId),
      this.userService.getPermissionCodes(userId),
      this.userService.getAccessibleMenuTree(userId),
      this.userService.getRoleNames(userId),
    ]);

    return {
      user,
      roles,
      permissions,
      menus,
    };
  }
}
