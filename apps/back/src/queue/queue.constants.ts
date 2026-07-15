/** 邮件队列名（注入 token 与 @Processor 关联键） */
export const MAIL_QUEUE = 'mail';

/** 短信队列名 */
export const SMS_QUEUE = 'sms';

/** 邮件类 Job 名 */
export const JOB_SEND_EMAIL_CODE = 'send-email-code';

/** 短信类 Job 名 */
export const JOB_SEND_SMS_CODE = 'send-sms-code';

/** 发送邮箱验证码的 Job 数据 */
export interface SendEmailCodeJobData {
  to: string;
  code: string;
  /** 用途文案，用于邮件主题/正文，如「注册验证码」 */
  purpose: string;
}

/** 发送手机验证码的 Job 数据 */
export interface SendSmsCodeJobData {
  phone: string;
  code: string;
  purpose: string;
}
