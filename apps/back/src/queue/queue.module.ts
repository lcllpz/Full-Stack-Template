import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { redisConfigKey } from '@/config/redis/config';
import { MailModule } from '@/mail/mail.module';
import { SmsModule } from '@/sms/sms.module';

import { MailProcessor } from './processors/mail.processor';
import { SmsProcessor } from './processors/sms.processor';
import { NotificationService } from './notification.service';
import { MAIL_QUEUE, SMS_QUEUE } from './queue.constants';

@Module({
  imports: [
    // BullMQ 全局连接：复用 Redis 配置。
    // 注意：BullMQ 的阻塞命令要求 maxRetriesPerRequest 必须为 null，
    // 因此这里单独建连接，不复用 RedisService（其设置了 maxRetriesPerRequest: 1）。
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const redis = configService.getOrThrow(redisConfigKey, { infer: true });
        return {
          connection: {
            host: redis.REDIS_HOST,
            port: redis.REDIS_PORT,
            password: redis.REDIS_PASSWORD,
            db: redis.REDIS_DB,
            maxRetriesPerRequest: null,
          },
          // 队列 key 前缀，便于多环境共用同一 Redis 时隔离
          prefix: redis.QUEUE_PREFIX,
        };
      },
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }, { name: SMS_QUEUE }),
    MailModule,
    SmsModule,
  ],
  providers: [NotificationService, MailProcessor, SmsProcessor],
  exports: [NotificationService],
})
export class QueueModule {}
