import { registerAs } from '@nestjs/config';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Environment } from '@/config/app/config.type';
import { validateConfig } from '@/utils/config/validate';

import { MailConfigType } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  MAIL_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  MAIL_PORT: number;

  @IsBoolean()
  @IsOptional()
  MAIL_SECURE: boolean;

  @IsString()
  @IsOptional()
  MAIL_USER: string;

  @IsString()
  @IsOptional()
  MAIL_PASSWORD: string;

  @IsString()
  @IsOptional()
  MAIL_FROM: string;

  @IsString()
  @IsOptional()
  MAIL_FROM_NAME: string;
}

export const mailConfigKey = 'mail';

export const mailConfig = registerAs<MailConfigType>(mailConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const isProduction = process.env.NODE_ENV === Environment.Production;
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;

  // 生产环境必须显式配置 SMTP，避免真实发信静默失败；开发环境允许留空（改由 dev 直接打印验证码）
  if (isProduction && (!host || !user || !process.env.MAIL_PASSWORD)) {
    throw new Error('MAIL_HOST / MAIL_USER / MAIL_PASSWORD are required in production');
  }

  return {
    MAIL_HOST: host || '',
    // 465 为最常用的 SMTP over SSL 端口
    MAIL_PORT: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 465,
    // 未显式配置时，按端口是否为 465 推断是否走 SSL 直连
    MAIL_SECURE:
      process.env.MAIL_SECURE !== undefined
        ? process.env.MAIL_SECURE === 'true'
        : (process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 465) === 465,
    MAIL_USER: user || '',
    MAIL_PASSWORD: process.env.MAIL_PASSWORD || '',
    // 发件人默认取登录账号
    MAIL_FROM: process.env.MAIL_FROM?.trim() || user || '',
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME?.trim() || 'Full-Stack-Template',
  };
});
