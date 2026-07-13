import { registerAs } from '@nestjs/config';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { validateConfig } from '@/utils/config/validate';

import { StorageConfigType, StorageDriver } from './config.type';

class EnvironmentVariablesValidator {
  @IsEnum(StorageDriver)
  @IsOptional()
  STORAGE_DRIVER: StorageDriver;

  @IsString()
  @IsOptional()
  UPLOAD_DIR: string;

  @IsString()
  @IsOptional()
  UPLOAD_PUBLIC_BASE_URL: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  UPLOAD_MAX_SIZE_BYTES: number;

  @IsString()
  @IsOptional()
  UPLOAD_ALLOWED_MIME_TYPES: string;
}

export const fileStorageConfigKey = 'fileStorage';

export const fileStorageConfig = registerAs<StorageConfigType>(fileStorageConfigKey, () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const allowedMimeTypes = process.env.UPLOAD_ALLOWED_MIME_TYPES?.split(',')
    .map((mimeType) => mimeType.trim().toLowerCase())
    .filter(Boolean) ?? ['image/jpeg', 'image/png', 'image/webp'];

  return {
    STORAGE_DRIVER: (process.env.STORAGE_DRIVER as StorageDriver) || StorageDriver.Local,
    UPLOAD_DIR: process.env.UPLOAD_DIR?.trim() || 'uploads',
    UPLOAD_PUBLIC_BASE_URL:
      process.env.UPLOAD_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') ||
      `http://localhost:${port}/uploads`,
    UPLOAD_MAX_SIZE_BYTES: process.env.UPLOAD_MAX_SIZE_BYTES
      ? parseInt(process.env.UPLOAD_MAX_SIZE_BYTES, 10)
      : 2 * 1024 * 1024,
    UPLOAD_ALLOWED_MIME_TYPES: allowedMimeTypes,
  };
});
