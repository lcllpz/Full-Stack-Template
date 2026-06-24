import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { appConfigKey } from '@/config/app/config';
import { AllConfigType } from '@/config/config.type';
import { loggerConfigKey } from '@/config/logger/config';

import { createWinstonLogger } from './create-winston-logger';
import { WINSTON_LOGGER } from './logger.constants';
import { WinstonNestLoggerService } from './winston-nest-logger.service';

@Global()
@Module({})
export class LoggerModule {
  static forRootAsync(): DynamicModule {
    return {
      module: LoggerModule,
      imports: [ConfigModule],
      providers: [
        {
          // 工厂 Provider：提供 winston 日志记录器
          provide: WINSTON_LOGGER,
          inject: [ConfigService],
          useFactory: (configService: ConfigService<AllConfigType>) => {
            const { nodeEnv } = configService.getOrThrow(appConfigKey, { infer: true });
            const logger = configService.getOrThrow(loggerConfigKey, { infer: true });

            return createWinstonLogger(logger, nodeEnv);
          },
        },
        WinstonNestLoggerService,
      ],
      exports: [WINSTON_LOGGER, WinstonNestLoggerService],
    };
  }
}
