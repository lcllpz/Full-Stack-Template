import { HttpStatus, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { authConfigKey } from '@/config/auth/config';
import { AllConfigType } from '@/config/config.type';
import { Session } from '@/session/entities/session.entity';
import { SessionService } from '@/session/session.service';
import { User } from '@/user/entities/user.entity';
import { UserService } from '@/user/user.service';

import { EmailPasswordRegisterDto } from './dto/email-password-register.dto';
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}
  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(SessionService)
  private readonly sessionService: SessionService;

  @Inject(ConfigService)
  private readonly configService: ConfigService<AllConfigType>;

  async register(registerDto: EmailPasswordRegisterDto) {
    await this.userService.create(registerDto);
    return {
      status: HttpStatus.CREATED,
      message: '注册成功',
    };
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
