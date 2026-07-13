import { appConfigKey } from './app/config';
import { AppConfig } from './app/config.type';
import { authConfigKey } from './auth/config';
import { AuthConfigType } from './auth/config.type';
import { dataBaseConfigKey } from './dataBase/config';
import { DataBaseConfigType } from './dataBase/config.type';
import { fileStorageConfigKey } from './fileStorage/config';
import { StorageConfigType } from './fileStorage/config.type';
import { loggerConfigKey } from './logger/config';
import { LoggerConfigType } from './logger/config.type';
import { redisConfigKey } from './redis/config';
import { RedisConfigType } from './redis/config.type';
import { seedsConfigKey } from './seeds/config';
import { SeedsConfigType } from './seeds/config.type';

export type AllConfigType = {
  [appConfigKey]: AppConfig;
  [dataBaseConfigKey]: DataBaseConfigType;
  [authConfigKey]: AuthConfigType;
  [loggerConfigKey]: LoggerConfigType;
  [redisConfigKey]: RedisConfigType;
  [seedsConfigKey]: SeedsConfigType;
  [fileStorageConfigKey]: StorageConfigType;
};
