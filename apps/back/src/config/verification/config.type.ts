export type VerificationConfigType = {
  // ── 短信/邮件 验证码 ──
  /** 验证码位数（纯数字） */
  CODE_LENGTH: number;
  /** 验证码有效期（秒） */
  CODE_TTL_SECONDS: number;
  /** 两次发送最小间隔（秒），防止频繁发送 */
  SEND_INTERVAL_SECONDS: number;
  /** 同一验证码最多允许校验错误次数，超过即作废 */
  MAX_ATTEMPTS: number;
  /** 单个目标（邮箱/手机）单日发送上限 */
  DAILY_LIMIT: number;

  // ── 图形验证码（SVG）──
  /** 图形验证码字符数 */
  CAPTCHA_LENGTH: number;
  /** 图形验证码有效期（秒） */
  CAPTCHA_TTL_SECONDS: number;
};
