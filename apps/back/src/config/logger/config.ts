import { registerAs } from '@nestjs/config';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { Environment } from '@/config/app/config.type';
import { validateConfig } from '@/utils/config/validate';

import { LoggerConfigType, LogLevel } from './config.type';
import {
  ENV_LOG_DIR,
  ENV_LOG_FILE_ENABLED,
  ENV_LOG_HTTP_ENABLED,
  ENV_LOG_LEVEL,
  ENV_LOG_MAX_FILES,
  ENV_LOG_MAX_SIZE,
  ENV_LOG_SLOW_MS,
  ENV_LOG_ZIPPED_ARCHIVE,
  LOG_DEFAULT_DIR,
  LOG_DEFAULT_MAX_FILES,
  LOG_DEFAULT_MAX_SIZE,
  LOG_DEFAULT_SLOW_MS,
} from './constants';

class EnvironmentVariablesValidator {
  @IsIn(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
  @IsOptional()
  LOG_LEVEL: string;

  @IsBoolean()
  @IsOptional()
  LOG_FILE_ENABLED: boolean;

  @IsString()
  @IsOptional()
  LOG_DIR: string;

  @IsString()
  @IsOptional()
  LOG_MAX_SIZE: string;

  @IsString()
  @IsOptional()
  LOG_MAX_FILES: string;

  @IsBoolean()
  @IsOptional()
  LOG_ZIPPED_ARCHIVE: boolean;

  @IsBoolean()
  @IsOptional()
  LOG_HTTP_ENABLED: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  LOG_SLOW_MS: number;
}

export const loggerConfigKey = 'logger';

const defaultLogLevel = (nodeEnv: Environment): LogLevel => {
  switch (nodeEnv) {
    case Environment.Production:
      return 'info';
    case Environment.Test:
      return 'warn';
    default:
      return 'debug';
  }
};

const defaultFileEnabled = (nodeEnv: Environment): boolean => nodeEnv === Environment.Production;

export const loggerConfig = registerAs<LoggerConfigType>(loggerConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const nodeEnv = (process.env.NODE_ENV as Environment) || Environment.Development;
  const parseBoolean = (value: string | undefined, fallback: boolean): boolean =>
    value !== undefined ? value === 'true' : fallback;

  const slowMs = Number(process.env[ENV_LOG_SLOW_MS]);

  return {
    LOG_LEVEL: (process.env[ENV_LOG_LEVEL] as LogLevel) || defaultLogLevel(nodeEnv),
    LOG_FILE_ENABLED: parseBoolean(process.env[ENV_LOG_FILE_ENABLED], defaultFileEnabled(nodeEnv)),
    LOG_DIR: process.env[ENV_LOG_DIR]?.trim() || LOG_DEFAULT_DIR,
    LOG_MAX_SIZE: process.env[ENV_LOG_MAX_SIZE]?.trim() || LOG_DEFAULT_MAX_SIZE,
    LOG_MAX_FILES: process.env[ENV_LOG_MAX_FILES]?.trim() || LOG_DEFAULT_MAX_FILES,
    LOG_ZIPPED_ARCHIVE: parseBoolean(process.env[ENV_LOG_ZIPPED_ARCHIVE], true),
    LOG_HTTP_ENABLED: parseBoolean(process.env[ENV_LOG_HTTP_ENABLED], true),
    LOG_SLOW_MS: Number.isFinite(slowMs) && slowMs >= 0 ? slowMs : LOG_DEFAULT_SLOW_MS,
  };
});
