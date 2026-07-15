import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { smsConfigKey } from '@/config/sms/config';
import { SmsDriver } from '@/config/sms/config.type';

import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { TencentSmsProvider } from './providers/tencent-sms.provider';
import { SMS_PROVIDER, SmsProvider } from './sms.provider.interface';
import { SmsService } from './sms.service';

// 根据 SMS_DRIVER 把 SMS_PROVIDER token 绑定到对应实现
const smsProviderFactory: Provider = {
  provide: SMS_PROVIDER,
  inject: [ConfigService, MockSmsProvider, AliyunSmsProvider, TencentSmsProvider],
  useFactory: (
    configService: ConfigService<AllConfigType>,
    mock: MockSmsProvider,
    aliyun: AliyunSmsProvider,
    tencent: TencentSmsProvider,
  ): SmsProvider => {
    const { SMS_DRIVER } = configService.getOrThrow(smsConfigKey, { infer: true });
    switch (SMS_DRIVER) {
      case SmsDriver.Aliyun:
        return aliyun;
      case SmsDriver.Tencent:
        return tencent;
      case SmsDriver.Mock:
      default:
        return mock;
    }
  },
};

@Module({
  providers: [
    MockSmsProvider,
    AliyunSmsProvider,
    TencentSmsProvider,
    smsProviderFactory,
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
