import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

import { AllConfigType } from '@/config/config.type';
import { fileStorageConfigKey } from '@/config/fileStorage/config';
import { StorageDriver } from '@/config/fileStorage/config.type';
import { UserModule } from '@/user/user.module';

import { AvatarFileValidationPipe } from './pipes/avatar-file-validation.pipe';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { STORAGE_PROVIDER } from './storage/storage.interface';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const config = configService.getOrThrow(fileStorageConfigKey, { infer: true });
        return {
          limits: {
            fileSize: config.UPLOAD_MAX_SIZE_BYTES,
            files: 1,
          },
        };
      },
    }),
  ],
  controllers: [FileController],
  providers: [
    FileService,
    AvatarFileValidationPipe,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const { STORAGE_DRIVER } = configService.getOrThrow(fileStorageConfigKey, { infer: true });
        if (STORAGE_DRIVER === StorageDriver.Local) {
          return new LocalStorageProvider(configService);
        }
        throw new Error(`存储驱动 ${STORAGE_DRIVER} 尚未实现`);
      },
    },
  ],
})
export class FileModule {}
