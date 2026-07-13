import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';

import { AUDIT_CLS_KEYS } from './audit/audit.constants';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { appConfig, appConfigKey } from './config/app/config';
import { Environment } from './config/app/config.type';
import { authConfig } from './config/auth/config';
import { AllConfigType } from './config/config.type';
import { dataBaseConfig, dataBaseConfigKey } from './config/dataBase/config';
import { fileStorageConfig } from './config/fileStorage/config';
import { loggerConfig } from './config/logger/config';
import { LOG_CLS_TRACE_ID, TRACE_ID_HEADER } from './config/logger/constants';
import { redisConfig } from './config/redis/config';
import { seedsConfig } from './config/seeds';
import { FileModule } from './file/file.module';
import { HealthController } from './health/health.controller';
import { LoggerModule } from './logger/logger.module';
import { MenuModule } from './menu/menu.module';
import { PermissionModule } from './permission/permission.module';
import { PermissionsGuard } from './permission/permissions.guard';
import { RedisModule } from './redis/redis.module';
import { RoleModule } from './role/role.module';
import { DatabaseModule } from './seeds/database.module';
import { AppThrottlerGuard } from './throttle/app-throttler.guard';
import { ThrottleModule } from './throttle/throttle.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，其他模块无需再 import
      // 数组里会按顺序尝试加载，如果某个变量在多个文件中存在，则以第一个文件中的值为准。

      envFilePath: [`.env.${process.env.NODE_ENV ?? Environment.Development}`, '.env'],
      load: [
        appConfig,
        authConfig,
        dataBaseConfig,
        loggerConfig,
        redisConfig,
        seedsConfig,
        fileStorageConfig,
      ],
    }),
    LoggerModule.forRootAsync(),
    // nestjs-cls（基于 AsyncLocalStorage 的请求级上下文），在每个 HTTP 请求进入时自动写入一些「跟本次请求绑定」的信息，供日志、审计、异常处理等模块在同一次请求链路里读取。
    ClsModule.forRoot({
      global: true,
      middleware: {
        // 自动挂载 Express/Fastify 中间件，每个 HTTP 请求都会先跑 setup。
        mount: true,
        setup: (cls, req, res) => {
          // 链路追踪 ID：优先透传上游/网关的 x-request-id，否则生成
          const incoming = req.headers[TRACE_ID_HEADER];
          // 同一请求的所有日志带相同 ID，可串联排查。
          const traceId = (typeof incoming === 'string' && incoming.trim()) || randomUUID();
          cls.set(LOG_CLS_TRACE_ID, traceId);
          // 将 traceId 设置到响应头，供下游/网关消费。
          res.setHeader(TRACE_ID_HEADER, traceId);

          const forwarded = req.headers['x-forwarded-for'];
          const ip =
            (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
            req.ip ??
            req.socket?.remoteAddress ??
            null;
          cls.set(AUDIT_CLS_KEYS.ip, ip);
          // 将用户 IP 和 User-Agent 也设置到上下文，供审计模块读取。
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
    ThrottleModule,

    UserModule,
    RoleModule,
    PermissionModule,
    AuthModule,
    MenuModule,
    AuditModule,

    DatabaseModule,

    FileModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // 全局守卫执行顺序（先注册先执行）：
    // 1. JwtAuthGuard → 身份认证（401），@Public() 跳过；限流前解析 req.user
    // 2. AppThrottlerGuard → 限流（已登录按 userId，未登录按 IP）
    // 3. PermissionsGuard → 权限校验（403），@SkipPermissions() / @Public() 跳过
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
