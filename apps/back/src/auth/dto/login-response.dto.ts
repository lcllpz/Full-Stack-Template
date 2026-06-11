import { User } from '@/user/entities/user.entity';

/** 登录成功响应；JWT 接入后补充 token / refreshToken / tokenExpires */
export class LoginResponseDto {
  /** access token（短期，Authorization: Bearer） */
  token?: string;

  /** refresh token（长期，用于 /auth/refresh） */
  refreshToken?: string;

  /** access token 过期时间戳（毫秒） */
  tokenExpires?: number;

  /** 当前会话 ID，写入 access token payload */
  sessionId: string;

  /** 不含 password 的用户信息 */
  user: Omit<User, 'password'>;
}
