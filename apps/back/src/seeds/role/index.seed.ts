import { DataSource } from 'typeorm';

import { Menu } from '@/menu/entities/menu.entity';
import { Role } from '@/role/entities/role.entity';

import { SeedsRunConfig } from '..';

/**
 * 角色种子数据（依赖 menu.seed 先执行）
 *
 * 预置角色：
 *   super_admin — 系统内置，绑定全部菜单
 *                 PermissionsGuard 对 super_admin 直接豁免，绑定菜单仅供权限管理界面展示
 *
 * 其他角色（admin / editor / viewer 等）在管理后台按需创建，不在种子中预置，
 * 避免演示数据进入生产环境。
 */
export async function seedRoles(
  dataSource: DataSource,
  _menuMap: Map<string, Menu>,
  config: Pick<SeedsRunConfig, 'SUPER_ADMIN_ROLE_NAME'>,
): Promise<Role> {
  const roleRepo = dataSource.getRepository(Role);
  const menuRepo = dataSource.getRepository(Menu);

  const { SUPER_ADMIN_ROLE_NAME } = config;

  // ── super_admin：绑定全部菜单 ─────────────────────────────
  let superAdmin = await roleRepo.findOne({
    where: { name: SUPER_ADMIN_ROLE_NAME },
    withDeleted: true,
    relations: { menus: true },
  });

  if (superAdmin) {
    // 已存在则恢复软删除并刷新菜单绑定
    if (superAdmin.deletedAt) {
      await roleRepo.recover(superAdmin);
    }
  } else {
    superAdmin = roleRepo.create({
      name: SUPER_ADMIN_ROLE_NAME,
      description: '超级管理员，拥有全部权限',
      isSystem: true,
    });
  }

  // 绑定当前全部菜单（每次执行自动补充新增菜单节点）
  superAdmin.menus = await menuRepo.find();
  await roleRepo.save(superAdmin);

  console.log(`✅ 角色种子完成：${SUPER_ADMIN_ROLE_NAME}（已绑定全部菜单）`);
  return superAdmin;
}
