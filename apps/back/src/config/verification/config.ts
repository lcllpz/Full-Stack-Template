import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { VerificationConfigType } from './config.type';

class EnvironmentVariablesValidator {
  @IsInt()
  @Min(4)
  @Max(8)
  @IsOptional()
  VERIFY_CODE_LENGTH: number;

  @IsInt()
  @Min(60)
  @IsOptional()
  VERIFY_CODE_TTL_SECONDS: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  VERIFY_SEND_INTERVAL_SECONDS: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  VERIFY_MAX_ATTEMPTS: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  VERIFY_DAILY_LIMIT: number;

  @IsInt()
  @Min(4)
  @Max(8)
  @IsOptional()
  CAPTCHA_LENGTH: number;

  @IsInt()
  @Min(30)
  @IsOptional()
  CAPTCHA_TTL_SECONDS: number;
}

export const verificationConfigKey = 'verification';

const toInt = (value: string | undefined, fallback: number): number =>
  value ? parseInt(value, 10) : fallback;

export const verificationConfig = registerAs<VerificationConfigType>(verificationConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    CODE_LENGTH: toInt(process.env.VERIFY_CODE_LENGTH, 6),
    // Redis SET EX 单位是秒；默认 300s = 5 分钟（勿写成 300*1000，那会变成约 3.5 天）
    CODE_TTL_SECONDS: toInt(process.env.VERIFY_CODE_TTL_SECONDS, 300),
    SEND_INTERVAL_SECONDS: toInt(process.env.VERIFY_SEND_INTERVAL_SECONDS, 60),
    MAX_ATTEMPTS: toInt(process.env.VERIFY_MAX_ATTEMPTS, 5),
    DAILY_LIMIT: toInt(process.env.VERIFY_DAILY_LIMIT, 10),
    CAPTCHA_LENGTH: toInt(process.env.CAPTCHA_LENGTH, 4),
    CAPTCHA_TTL_SECONDS: toInt(process.env.CAPTCHA_TTL_SECONDS, 120),
  };
});
