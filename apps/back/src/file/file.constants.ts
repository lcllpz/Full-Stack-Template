import { THROTTLE_TTL_MS } from '@/throttle/throttle.constants';

/** 头像上传单独限流，避免频繁占用内存和磁盘。 */
export const AVATAR_UPLOAD_THROTTLE = {
  limit: 10,
  ttl: THROTTLE_TTL_MS,
} as const;
