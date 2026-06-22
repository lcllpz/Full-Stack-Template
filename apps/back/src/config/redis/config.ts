import { registerAs } from '@nestjs/config';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { RedisConfigType } from './config.type';
import {
  ENV_PERMISSION_CACHE_TTL_SECONDS,
  ENV_REDIS_DB,
  ENV_REDIS_ENABLED,
  ENV_REDIS_HOST,
  ENV_REDIS_PASSWORD,
  ENV_REDIS_PORT,
  REDIS_DEFAULT_DB,
  REDIS_DEFAULT_HOST,
  REDIS_DEFAULT_PORT,
} from './constants';

class EnvironmentVariablesValidator {
  @IsBoolean()
  @IsOptional()
  REDIS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  REDIS_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD: string;

  @IsInt()
  @Min(0)
  @Max(15)
  @IsOptional()
  REDIS_DB: number;

  @IsInt()
  @Min(60)
  @IsOptional()
  REDIS_PERMISSION_CACHE_TTL_SECONDS: number;
}

export const redisConfigKey = 'redis';

export const redisConfig = registerAs<RedisConfigType>(redisConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const parseBoolean = (value: string | undefined): boolean => value === 'true';

  return {
    REDIS_ENABLED: parseBoolean(process.env[ENV_REDIS_ENABLED]),
    REDIS_HOST: process.env[ENV_REDIS_HOST] || REDIS_DEFAULT_HOST,
    REDIS_PORT: process.env[ENV_REDIS_PORT]
      ? parseInt(process.env[ENV_REDIS_PORT], 10)
      : REDIS_DEFAULT_PORT,
    REDIS_PASSWORD: process.env[ENV_REDIS_PASSWORD]?.trim() || undefined,
    REDIS_DB: process.env[ENV_REDIS_DB]
      ? parseInt(process.env[ENV_REDIS_DB], 10)
      : REDIS_DEFAULT_DB,
    PERMISSION_CACHE_TTL_SECONDS: process.env[ENV_PERMISSION_CACHE_TTL_SECONDS]
      ? parseInt(process.env[ENV_PERMISSION_CACHE_TTL_SECONDS], 10)
      : undefined,
  };
});
