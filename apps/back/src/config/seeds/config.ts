import { registerAs } from '@nestjs/config';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { SeedsConfigType } from './config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  SUPER_ADMIN_EMAIL: string;

  @IsString()
  @IsOptional()
  SUPER_ADMIN_PASSWORD: string;

  @IsString()
  @IsOptional()
  SUPER_ADMIN_ROLE_NAME: string;

  @IsBoolean()
  @IsOptional()
  RUN_SEEDS: boolean;

  @IsBoolean()
  @IsOptional()
  FORCE_SEEDS: boolean;
}

// 配置项的唯一标识符
export const seedsConfigKey = 'seeds';

// 配置项的注册函数
export const seedsConfig = registerAs<SeedsConfigType>(seedsConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ?? 'Super_admin1@qq.com',
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD ?? 'Super_admin1@qq.com',
    SUPER_ADMIN_ROLE_NAME: process.env.SUPER_ADMIN_ROLE_NAME ?? 'super_admin',
    RUN_SEEDS: typeof process.env.RUN_SEEDS === 'boolean' ? process.env.RUN_SEEDS : true,
    FORCE_SEEDS: typeof process.env.FORCE_SEEDS === 'boolean' ? process.env.FORCE_SEEDS : false,
  };
});
