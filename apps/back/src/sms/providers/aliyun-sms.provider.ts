import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { smsConfigKey } from '@/config/sms/config';

import { SmsProvider } from '../sms.provider.interface';

/**
 * 阿里云短信提供方（预留）。
 * 接入时安装官方 SDK（@alicloud/dysmsapi20170525），
 * 使用 SMS_ACCESS_KEY_ID / SECRET / SIGN_NAME / TEMPLATE_CODE 调用 SendSms。
 */
@Injectable()
export class AliyunSmsProvider implements SmsProvider {
  private readonly logger = new Logger(AliyunSmsProvider.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    const config = this.configService.getOrThrow(smsConfigKey, { infer: true });
    // TODO: 接入阿里云 SDK，用 config.SMS_* 参数调用真实发送
    this.logger.error(`阿里云短信尚未实现：phone=${phone}, signName=${config.SMS_SIGN_NAME}`);
    void code;
    await Promise.resolve();
    throw new NotImplementedException('阿里云短信发送尚未实现');
  }
}
