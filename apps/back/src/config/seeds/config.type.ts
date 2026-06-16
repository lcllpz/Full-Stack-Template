// 种子数据配置类型
export type SeedsConfigType = {
  /** 超级管理员登录标识（存于 users.email 字段） */
  SUPER_ADMIN_EMAIL: string;

  /** 超级管理员登录密码（明文，写入前会 bcrypt 加密） */
  SUPER_ADMIN_PASSWORD: string;

  /** 超级管理员角色名称，与 PermissionsGuard 豁免逻辑保持一致 */
  SUPER_ADMIN_ROLE_NAME: string;

  RUN_SEEDS: boolean;

  FORCE_SEEDS: boolean;
};
