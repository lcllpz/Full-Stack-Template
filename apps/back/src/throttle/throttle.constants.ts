/** 限流窗口（毫秒），与 rbac-plan 6.4 一致：按分钟计数 */
export const THROTTLE_TTL_MS = 60000;

/** 未登录敏感接口（login / register） */
export const THROTTLE_LIMIT_AUTH = 10;
// export const THROTTLE_LIMIT_AUTH = 1;

/** 已登录普通用户 */
export const THROTTLE_LIMIT_DEFAULT = 60;
// export const THROTTLE_LIMIT_DEFAULT = 1;

/** 超级管理员角色（支持批量管理操作） */
export const THROTTLE_LIMIT_ADMIN = 300;
// export const THROTTLE_LIMIT_ADMIN = 2;

export const THROTTLE_ERROR_MESSAGE = '操作过于频繁，请稍后再试';
