import { registerAs } from '@nestjs/config';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { AppConfig, Environment } from './config.type';

export { Environment };

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT: number;
}

// 配置项的唯一标识符
export const appConfigKey = 'app';

// 配置项的注册函数
export const appConfig = registerAs<AppConfig>(appConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    nodeEnv: (process.env.NODE_ENV as Environment) || Environment.Development,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  };
});
