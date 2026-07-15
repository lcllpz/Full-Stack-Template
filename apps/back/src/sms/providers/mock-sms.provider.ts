import { Injectable, Logger } from '@nestjs/common';

import { SmsProvider } from '../sms.provider.interface';

/**
 * Mock 短信提供方：不对接任何云厂商，直接把验证码打印到日志。
 * 用于本地开发 / 测试，避免真实短信费用与账号依赖。
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendVerificationCode(phone: string, code: string, purpose = '验证码'): Promise<void> {
    this.logger.warn(`[DEV] Mock 短信不实际发送 → phone=${phone} code=${code} 用途=${purpose}`);
    await Promise.resolve();
  }
}
