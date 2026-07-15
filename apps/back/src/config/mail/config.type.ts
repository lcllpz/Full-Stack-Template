export type MailConfigType = {
  /** SMTP 服务器地址，如 smtp.qq.com */
  MAIL_HOST: string;
  /** SMTP 端口：465(SSL) / 587(STARTTLS) / 25(明文) */
  MAIL_PORT: number;
  /** 是否使用 SSL/TLS 直连（465 端口通常为 true；587 用 STARTTLS 则为 false） */
  MAIL_SECURE: boolean;
  /** SMTP 登录账号（通常即发件邮箱） */
  MAIL_USER: string;
  /** SMTP 登录密码 / 授权码（QQ、163 等需使用授权码而非登录密码） */
  MAIL_PASSWORD: string;
  /** 发件人邮箱地址，默认与 MAIL_USER 一致 */
  MAIL_FROM: string;
  /** 发件人显示名称 */
  MAIL_FROM_NAME: string;
};
