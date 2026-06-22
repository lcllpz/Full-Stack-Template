import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { RedisService } from '@/redis/redis.service';

/**
 * 限流计数存储：
 * - Redis 已启用 → 复用 RedisService 的 ioredis 连接（与权限缓存共用）
 * - 未启用 / 连接失败 → 进程内 Map 降级
 *
 * @see https://docs.nestjs.com/security/rate-limiting#storages
 */
export function createThrottlerStorage(redisService: RedisService): ThrottlerStorage {
  const client = redisService.getClient();
  if (!client || !redisService.isEnabled) {
    return new ThrottlerStorageService();
  }

  // 传入已有 client，不会另建连接，也不会在 destroy 时 disconnect
  return new ThrottlerStorageRedisService(client);
}
