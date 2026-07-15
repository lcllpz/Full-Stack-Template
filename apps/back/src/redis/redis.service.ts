import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { redisConfigKey } from '@/config/redis/config';
import { RedisConfigType } from '@/config/redis/config.type';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getOrThrow<RedisConfigType>(redisConfigKey, { infer: true });
    this.enabled = config.REDIS_ENABLED;

    if (!this.enabled) {
      return;
    }

    this.client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DB,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis 连接异常: ${error.message}`);
    });
  }

  /** 供限流等模块复用同一 ioredis 连接；未启用或连接失败时为 null */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * 供「强依赖 Redis」的功能（图形验证码、短信/邮件验证码）获取原始客户端。
   * 这些功能不能像权限缓存那样降级查库——若 Redis 不可用直接抛 503，
   * 避免验证码校验被绕过带来的安全风险。
   */
  getClientOrThrow(): Redis {
    if (!this.isEnabled || !this.client) {
      throw new ServiceUnavailableException('验证码服务不可用：Redis 未启用或连接失败');
    }
    return this.client;
  }

  get isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Redis 未启用（REDIS_ENABLED=false），权限缓存将直接查库');
      return;
    }

    if (!this.client) return;

    void this.client.connect().catch((error: Error) => {
      this.logger.error(`Redis 连接失败，将降级为直接查库: ${error.message}`);
      this.client?.disconnect();
      this.client = null;
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Redis GET 失败 key=${key}: ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled || !this.client) return;
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis SET 失败 key=${key}: ${(error as Error).message}`);
    }
  }

  async del(keys: string[]): Promise<void> {
    if (!this.isEnabled || !this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (error) {
      this.logger.warn(`Redis DEL 失败: ${(error as Error).message}`);
    }
  }
}
