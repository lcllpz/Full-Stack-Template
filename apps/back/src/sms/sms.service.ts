import { Inject, Injectable } from '@nestjs/common';

import type { SmsProvider } from './sms.provider.interface';
import { SMS_PROVIDER } from './sms.provider.interface';

/**
 * 短信业务门面：对上层屏蔽具体厂商。
 * 实际发送委托给按配置绑定的 SmsProvider（见 SmsModule 的 provider 工厂）。
 */
@Injectable()
export class SmsService {
  constructor(@Inject(SMS_PROVIDER) private readonly provider: SmsProvider) {}

  sendVerificationCode(phone: string, code: string, purpose = '验证码'): Promise<void> {
    return this.provider.sendVerificationCode(phone, code, purpose);
  }
}
