import { registerAs } from '@nestjs/config';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { SmsConfigType, SmsDriver } from './config.type';

class EnvironmentVariablesValidator {
  @IsEnum(SmsDriver)
  @IsOptional()
  SMS_DRIVER: SmsDriver;

  @IsString()
  @IsOptional()
  SMS_ACCESS_KEY_ID: string;

  @IsString()
  @IsOptional()
  SMS_ACCESS_KEY_SECRET: string;

  @IsString()
  @IsOptional()
  SMS_SIGN_NAME: string;

  @IsString()
  @IsOptional()
  SMS_TEMPLATE_CODE: string;
}

export const smsConfigKey = 'sms';

export const smsConfig = registerAs<SmsConfigType>(smsConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  // 默认使用 mock 驱动：本地开发无需任何云厂商账号即可跑通验证码流程
  const driver = (process.env.SMS_DRIVER as SmsDriver) || SmsDriver.Mock;

  // 选择真实厂商驱动时，密钥/签名/模板缺一不可
  if (driver !== SmsDriver.Mock) {
    const missing = [
      ['SMS_ACCESS_KEY_ID', process.env.SMS_ACCESS_KEY_ID],
      ['SMS_ACCESS_KEY_SECRET', process.env.SMS_ACCESS_KEY_SECRET],
      ['SMS_SIGN_NAME', process.env.SMS_SIGN_NAME],
      ['SMS_TEMPLATE_CODE', process.env.SMS_TEMPLATE_CODE],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missing.length) {
      throw new Error(`SMS_DRIVER=${driver} 需要配置：${missing.join(', ')}`);
    }
  }

  return {
    SMS_DRIVER: driver,
    SMS_ACCESS_KEY_ID: process.env.SMS_ACCESS_KEY_ID?.trim() || undefined,
    SMS_ACCESS_KEY_SECRET: process.env.SMS_ACCESS_KEY_SECRET?.trim() || undefined,
    SMS_SIGN_NAME: process.env.SMS_SIGN_NAME?.trim() || undefined,
    SMS_TEMPLATE_CODE: process.env.SMS_TEMPLATE_CODE?.trim() || undefined,
  };
});
