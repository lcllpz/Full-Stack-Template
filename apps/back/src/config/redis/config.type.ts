export type RedisConfigType = {
  REDIS_ENABLED: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  /** 权限/菜单缓存 TTL（秒）；未配置 env 时由 JWT_EXPIRES_IN 推导 */
  PERMISSION_CACHE_TTL_SECONDS?: number;
  /** 队列前缀 */
  QUEUE_PREFIX?: string;
};
