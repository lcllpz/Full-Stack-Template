import { DataSource, Repository } from 'typeorm';

import { Menu } from '@/menu/entities/menu.entity';
import { menuList } from '@/permission/permission.constants';

/**
 * 菜单树种子数据
 *
 * 数据来源：permission.constants.ts 中的 menuList（单一数据源）
 * 幂等策略：按 code 字段 upsert，已存在则跳过，不存在则创建
 * 执行顺序：必须在 role.seed 之前执行
 *
 * 返回 Map<code, Menu> 供 role.seed 按 code 取节点引用
 */
export async function seedMenus(dataSource: DataSource): Promise<Map<string, Menu>> {
  const menuRepo = dataSource.getRepository(Menu);
  const codeMap = new Map<string, Menu>();

  await seedMenusRecursive(menuRepo, menuList, null, codeMap);

  console.log(`✅ 菜单种子完成：共 ${codeMap.size} 条记录`);
  return codeMap;
}

/**
 * 递归 upsert 菜单树（支持任意深度）
 *
 * @param menuRepo  菜单仓库
 * @param nodes     当前层级的节点列表
 * @param parentId  父节点 id，顶层传 null
 * @param codeMap   收集 code → Menu 映射，供 role.seed 使用
 */
async function seedMenusRecursive(
  menuRepo: Repository<Menu>,
  nodes: typeof menuList,
  parentId: string | null,
  codeMap: Map<string, Menu>,
): Promise<void> {
  for (let i = 0; i < nodes.length; i++) {
    const { children, ...nodeData } = nodes[i];

    const saved = await upsertMenu(menuRepo, {
      ...nodeData,
      sort: nodeData.sort ?? i + 1,
      parentId,
    });

    if (saved.code) codeMap.set(saved.code, saved);

    // 若存在子节点则递归处理，深度不受限制
    if (children?.length) {
      await seedMenusRecursive(menuRepo, children, saved.id, codeMap);
    }
  }
}

/**
 * 按 code 幂等写入菜单记录
 * - code 存在：直接返回已有记录（不覆盖用户在管理后台的修改）
 * - code 不存在：创建新记录
 */
async function upsertMenu(menuRepo: Repository<Menu>, data: Partial<Menu>): Promise<Menu> {
  if (data.code) {
    const existing = await menuRepo.findOne({ where: { code: data.code }, withDeleted: true });
    if (existing) {
      // 若已软删除则恢复
      if (existing.deletedAt) {
        await menuRepo.recover(existing);
      }
      return existing;
    }
  }
  return menuRepo.save(menuRepo.create(data));
}
