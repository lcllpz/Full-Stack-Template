/**
 * 验证码「场景」枚举 —— 必须严格隔离。
 * 不同场景使用不同的 Redis 键，防止「注册验证码」被拿去「重置密码」等跨场景滥用。
 */
export enum VerifyScene {
  /** 注册 */
  REGISTER = 'register',
  /** 邮箱验证码登录 */
  LOGIN_EMAIL = 'login_email',
  /** 手机验证码登录 */
  LOGIN_PHONE = 'login_phone',
  /** 邮箱渠道重置密码 */
  RESET_PWD_EMAIL = 'reset_pwd_email',
  /** 手机渠道重置密码 */
  RESET_PWD_PHONE = 'reset_pwd_phone',
  /** 绑定手机号 */
  BIND_PHONE = 'bind_phone',
  /** 换绑邮箱：验证旧邮箱身份 */
  REBIND_EMAIL_OLD = 'rebind_email_old',
  /** 换绑邮箱：验证新邮箱 */
  REBIND_EMAIL_NEW = 'rebind_email_new',
  /** 换绑手机：验证旧手机身份 */
  REBIND_PHONE_OLD = 'rebind_phone_old',
  /** 换绑手机：验证新手机 */
  REBIND_PHONE_NEW = 'rebind_phone_new',
}

/** 验证码相关 Redis 键前缀 */
export const VERIFY_KEY_PREFIX = 'verify';

/** 验证码本体键：verify:code:{scene}:{target} */
export const codeKey = (scene: VerifyScene, target: string): string =>
  `${VERIFY_KEY_PREFIX}:code:${scene}:${target}`;

/** 发送频率锁键：verify:lock:{scene}:{target}（存在即代表在最小间隔内已发过） */
export const lockKey = (scene: VerifyScene, target: string): string =>
  `${VERIFY_KEY_PREFIX}:lock:${scene}:${target}`;

/** 单日发送计数键：verify:daily:{scene}:{target}:{yyyymmdd}（按天自然隔离） */
export const dailyKey = (scene: VerifyScene, target: string, date: string): string =>
  `${VERIFY_KEY_PREFIX}:daily:${scene}:${target}:${date}`;

/** 一天的秒数，用于单日计数键的过期 */
export const ONE_DAY_SECONDS = 24 * 60 * 60;

/** Redis 中存储的验证码结构 */
export interface StoredCode {
  /** 验证码哈希（明文不落库） */
  codeHash: string;
  /** 已校验错误次数 */
  attempts: number;
}
