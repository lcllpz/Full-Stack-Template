/** SMS 提供方注入 token（多实现时按配置绑定到具体 provider） */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * 短信发送抽象。
 * 不同厂商（mock / 阿里云 / 腾讯云）实现同一接口，业务层只依赖此抽象。
 */
export interface SmsProvider {
  /** 发送验证码短信 */
  sendVerificationCode(phone: string, code: string, purpose?: string): Promise<void>;
}
