/** Redis 缓存 key 命名空间，避免多项目共用实例时冲突 */
export const REDIS_KEY_NAMESPACE = 'fst';

/** 用户权限码缓存 key：fst:user_perms:{userId} */
export const buildUserPermsKey = (userId: string): string =>
  `${REDIS_KEY_NAMESPACE}:user_perms:${userId}`;

/** 用户可见菜单树缓存 key：fst:user_menus:{userId} */
export const buildUserMenusKey = (userId: string): string =>
  `${REDIS_KEY_NAMESPACE}:user_menus:${userId}`;

/** 权限/菜单缓存 TTL 环境变量（秒）；未设置时与 JWT_EXPIRES_IN 对齐 */
export const ENV_PERMISSION_CACHE_TTL_SECONDS = 'REDIS_PERMISSION_CACHE_TTL_SECONDS';

/** Redis 连接相关环境变量名 */
export const ENV_REDIS_ENABLED = 'REDIS_ENABLED';
export const ENV_REDIS_HOST = 'REDIS_HOST';
export const ENV_REDIS_PORT = 'REDIS_PORT';
export const ENV_REDIS_PASSWORD = 'REDIS_PASSWORD';
export const ENV_REDIS_DB = 'REDIS_DB';

/** 连接默认值 */
export const REDIS_DEFAULT_HOST = 'localhost';
export const REDIS_DEFAULT_PORT = 6379;
export const REDIS_DEFAULT_DB = 0;

/** 权限缓存 TTL 兜底（秒），JWT 解析失败时使用 */
export const PERMISSION_CACHE_FALLBACK_TTL_SECONDS = 900;
