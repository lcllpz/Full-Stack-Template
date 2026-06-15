import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { DataBaseConfigType } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  DATABASE_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  DATABASE_PORT: number;

  @IsString()
  @IsOptional()
  DATABASE_USER: string;

  @IsString()
  @IsOptional()
  DATABASE_PASSWORD: string;

  @IsString()
  @IsOptional()
  DATABASE_NAME: string;
}

// 配置项的唯一标识符
export const dataBaseConfigKey = 'dataBase';

// 配置项的注册函数
export const dataBaseConfig = registerAs<DataBaseConfigType>(dataBaseConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
    DATABASE_PORT: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 3306,
    DATABASE_USER: process.env.DATABASE_USER || 'root',
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'root',
    DATABASE_NAME: process.env.DATABASE_NAME || 'fullstacktemplate',
  };
});
