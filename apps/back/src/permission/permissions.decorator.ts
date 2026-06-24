import { SetMetadata } from '@nestjs/common';

import { PermissionCode } from '@/permission/permission.constants';

export const PERMISSIONS_KEY = 'permissions';
export const SKIP_PERMISSIONS_KEY = 'skipPermissions';

/**
 * 标注接口所需的权限码（BUTTON 类型菜单的 code）
 * 配合全局 PermissionsGuard 使用
 *
 * @example
 * @Permissions(PERMISSIONS.USER_CREATE)
 * @Post()
 * create() { ... }
 */
export const Permissions = (...codes: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, codes);

/**
 * 跳过权限校验（通常加在 Controller 类上，如 AuthController）
 * 与 @Public() 不同：仍可能经过 JWT 鉴权，只是不检查 @Permissions
 */
export const SkipPermissions = () => SetMetadata(SKIP_PERMISSIONS_KEY, true);
