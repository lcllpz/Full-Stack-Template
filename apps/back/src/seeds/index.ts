import { DataSource } from 'typeorm';

import { AuthConfigType } from '@/config/auth/config.type';
import { SeedsConfigType } from '@/config/seeds';
import { Role } from '@/role/entities/role.entity';

import { seedAdmin } from './admin/index.seed';
import { seedMenus } from './menu/index.seed';
import { seedRoles } from './role/index.seed';

/** runSeeds 所需配置（由 DatabaseModule 通过 ConfigService 注入后传入） */
export type SeedsRunConfig = Pick<
  SeedsConfigType,
  'SUPER_ADMIN_EMAIL' | 'SUPER_ADMIN_PASSWORD' | 'SUPER_ADMIN_ROLE_NAME' | 'FORCE_SEEDS'
> &
  Pick<AuthConfigType, 'BCRYPT_SALT_ROUNDS'>;

/**
 * 执行全部种子数据（顺序不可打乱）
 * 1. 菜单树 → 2. 角色（含菜单绑定）→ 3. 系统账号
 *
 * 首次运行检测：
 *   - 查询 SUPER_ADMIN_ROLE_NAME 角色是否已存在
 *   - 已存在且非软删除 → 跳过全部 seed（系统已初始化）
 *   - 不存在或已软删除 → 执行全部 seed（首次部署或数据恢复）
 *
 * 若需强制重新执行（如新增了菜单节点），可设置 FORCE_SEEDS=true
 */
export async function runSeeds(dataSource: DataSource, config: SeedsRunConfig): Promise<void> {
  const roleRepo = dataSource.getRepository(Role);
  const forceSeed = config.FORCE_SEEDS === true;

  if (!forceSeed) {
    const superAdminExists = await roleRepo.findOne({
      where: { name: config.SUPER_ADMIN_ROLE_NAME },
      select: { id: true },
      withDeleted: false,
    });
    if (superAdminExists) {
      console.log('⏭  种子数据已初始化，跳过执行（设置 FORCE_SEEDS=true 可强制重跑）');
      return;
    }
  }

  console.log('🌱 开始执行种子数据...');
  const menuMap = await seedMenus(dataSource);
  await seedRoles(dataSource, menuMap, config);
  await seedAdmin(dataSource, config);
  console.log('🎉 种子数据执行完毕');
}
