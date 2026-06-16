import { SetMetadata } from '@nestjs/common';

import { PermissionCode } from '@/permission/permission.constants';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 标注接口所需的权限码（BUTTON 类型菜单的 code）
 * 配合 PermissionsGuard 使用
 *
 * @example
 * @Permissions(PERMISSIONS.USER_CREATE)
 * @Post()
 * create() { ... }
 */
export const Permissions = (...codes: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, codes);
