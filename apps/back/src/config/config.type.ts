import { appConfigKey } from './app/config';
import { AppConfig } from './app/config.type';
import { authConfigKey } from './auth/config';
import { AuthConfigType } from './auth/config.type';
import { dataBaseConfigKey } from './dataBase/config';
import { DataBaseConfigType } from './dataBase/config.type';
import { seedsConfigKey } from './seeds/config';
import { SeedsConfigType } from './seeds/config.type';

export type AllConfigType = {
  [appConfigKey]: AppConfig;
  [dataBaseConfigKey]: DataBaseConfigType;
  [authConfigKey]: AuthConfigType;
  [seedsConfigKey]: SeedsConfigType;
};
