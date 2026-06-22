import { registerAs } from '@nestjs/config';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { SWAGGER_DEFAULT_PATH } from '@/swagger/swagger.constants';
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

  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED: boolean;

  @IsString()
  @IsOptional()
  SWAGGER_PATH: string;
}

// 配置项的唯一标识符
export const appConfigKey = 'app';

// 配置项的注册函数
export const appConfig = registerAs<AppConfig>(appConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const nodeEnv = (process.env.NODE_ENV as Environment) || Environment.Development;
  const parseBoolean = (value: string | undefined): boolean => value === 'true';

  return {
    nodeEnv,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    swaggerEnabled:
      process.env.SWAGGER_ENABLED !== undefined
        ? parseBoolean(process.env.SWAGGER_ENABLED)
        : nodeEnv !== Environment.Production,
    swaggerPath: process.env.SWAGGER_PATH?.trim() || SWAGGER_DEFAULT_PATH,
  };
});
