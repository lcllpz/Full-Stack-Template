import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { appConfig, appConfigKey } from './config/app/config';
import { Environment } from './config/app/config.type';
import { authConfig } from './config/auth/config';
import { AllConfigType } from './config/config.type';
import { dataBaseConfig, dataBaseConfigKey } from './config/dataBase/config';
import { RoleModule } from './role/role.module';
import { UserModule } from './user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，其他模块无需再 import
      envFilePath: [`.env.${process.env.NODE_ENV ?? Environment.Development}`, '.env'],
      load: [appConfig, authConfig, dataBaseConfig],
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
    UserModule,
    RoleModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
