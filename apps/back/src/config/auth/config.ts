import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Environment } from '@/config/app/config.type';
import { validateConfig } from '@/utils/config/validate';

import { AuthConfigType } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsInt()
  @Min(8)
  @Max(14)
  @IsOptional()
  BCRYPT_SALT_ROUNDS: number;
}

// 配置项的唯一标识符
export const authConfigKey = 'auth';

// 配置项的注册函数
export const authConfig = registerAs<AuthConfigType>(authConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const isProduction = process.env.NODE_ENV === Environment.Production;
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (isProduction) {
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required in production');
    }
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is required in production');
    }
  }

  return {
    JWT_SECRET: jwtSecret || 'development',
    JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '15m') as AuthConfigType['JWT_EXPIRES_IN'],

    JWT_REFRESH_SECRET: jwtRefreshSecret || 'development',
    JWT_REFRESH_EXPIRES_IN: (process.env.JWT_REFRESH_EXPIRES_IN ||
      '7d') as AuthConfigType['JWT_REFRESH_EXPIRES_IN'],

    BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS
      ? parseInt(process.env.BCRYPT_SALT_ROUNDS, 10)
      : 10,
  };
});
