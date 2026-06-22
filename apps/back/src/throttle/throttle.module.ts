import type { ExecutionContext } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AllConfigType } from '@/config/config.type';
import { seedsConfigKey } from '@/config/seeds/config';
import { RedisService } from '@/redis/redis.service';
import { UserModule } from '@/user/user.module';
import { UserService } from '@/user/user.service';

import { AppThrottlerGuard } from './app-throttler.guard';
import {
  THROTTLE_ERROR_MESSAGE,
  THROTTLE_LIMIT_ADMIN,
  THROTTLE_LIMIT_DEFAULT,
  THROTTLE_TTL_MS,
} from './throttle.constants';
import { createThrottlerStorage } from './throttle-storage.factory';

@Global()
@Module({
  imports: [
    UserModule,
    ThrottlerModule.forRootAsync({
      imports: [UserModule, ConfigModule],
      inject: [UserService, ConfigService, RedisService],
      useFactory: (
        userService: UserService,
        configService: ConfigService<AllConfigType>,
        redisService: RedisService,
      ) => ({
        storage: createThrottlerStorage(redisService),
        throttlers: [
          // 路由上的 @Throttle > ThrottleModule.forRootAsync 里的全局配置
          {
            ttl: THROTTLE_TTL_MS,
            limit: async (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest<{ user?: { userId: string } }>();
              const userId = req.user?.userId;
              if (!userId) {
                return THROTTLE_LIMIT_DEFAULT;
              }

              const { SUPER_ADMIN_ROLE_NAME } = configService.getOrThrow(seedsConfigKey, {
                infer: true,
              });
              const roleNames = await userService.getRoleNames(userId);
              if (roleNames.includes(SUPER_ADMIN_ROLE_NAME)) {
                return THROTTLE_LIMIT_ADMIN;
              }
              return THROTTLE_LIMIT_DEFAULT;
            },
          },
        ],
        errorMessage: THROTTLE_ERROR_MESSAGE,
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class ThrottleModule {}
