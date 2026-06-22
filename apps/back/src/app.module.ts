import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';

import { AUDIT_CLS_KEYS } from './audit/audit.constants';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { appConfig, appConfigKey } from './config/app/config';
import { Environment } from './config/app/config.type';
import { authConfig } from './config/auth/config';
import { AllConfigType } from './config/config.type';
import { dataBaseConfig, dataBaseConfigKey } from './config/dataBase/config';
import { redisConfig } from './config/redis/config';
import { seedsConfig } from './config/seeds';
import { MenuModule } from './menu/menu.module';
import { RedisModule } from './redis/redis.module';
import { RoleModule } from './role/role.module';
import { DatabaseModule } from './seeds/database.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，其他模块无需再 import
      envFilePath: [`.env.${process.env.NODE_ENV ?? Environment.Development}`, '.env'],
      load: [appConfig, authConfig, dataBaseConfig, redisConfig, seedsConfig],
    }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          const forwarded = req.headers['x-forwarded-for'];
          const ip =
            (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
            req.ip ??
            req.socket?.remoteAddress ??
            null;
          cls.set(AUDIT_CLS_KEYS.ip, ip);
          cls.set(AUDIT_CLS_KEYS.userAgent, req.headers['user-agent'] ?? null);
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const { nodeEnv } = configService.getOrThrow(appConfigKey, {
          infer: true,
        });
        const dataBase = configService.getOrThrow(dataBaseConfigKey, {
          infer: true,
        });
        return {
          type: 'mysql',
          host: dataBase.DATABASE_HOST,
          port: dataBase.DATABASE_PORT,
          username: dataBase.DATABASE_USER,
          password: dataBase.DATABASE_PASSWORD,
          database: dataBase.DATABASE_NAME,
          // 配置实例
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: nodeEnv !== Environment.Production,
          timezone: 'Z',
        };
      },
    }),
    RedisModule,

    UserModule,
    RoleModule,
    AuthModule,
    MenuModule,
    AuditModule,

    DatabaseModule,
  ],
})
export class AppModule {}
