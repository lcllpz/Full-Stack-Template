import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CreateMenuDto } from './dto/create-menu.dto';
import { ACTION_LABELS, CreateModuleDto, STANDARD_ACTIONS } from './dto/create-module.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Menu, MenuType } from './entities/menu.entity';

/** 带 children 的树节点类型 */
export type MenuTreeNode = Omit<Menu, 'roles'> & { children: MenuTreeNode[] };

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
  ) {}

  // ─── 单条创建 ────────────────────────────────────────────────

  async create(dto: CreateMenuDto): Promise<Menu> {
    const { type } = dto;

    // BUTTON 类型：path 强制为 null，visible 强制为 false
    if (type === MenuType.BUTTON) {
      dto.path = undefined;
      dto.visible = false;
    }

    // parentId 归一化：DTO Transform 已处理 0/'0'，这里再兜底一次
    const parentId = dto.parentId ?? null;

    if (dto.code) {
      const exists = await this.menuRepo.findOne({ where: { code: dto.code } });
      if (exists) throw new ConflictException(`权限码 ${dto.code} 已存在`);
    }

    const menu = this.menuRepo.create({ ...dto, type, parentId });
    return this.menuRepo.save(menu);
  }

  // ─── 一键生成标准模块菜单树 ──────────────────────────────────

  /**
   * 传入模块信息，自动生成：
   *   - 1 个 MENU 节点（页面）
   *   - N 个 BUTTON 节点（默认 read/create/update/delete）
   *
   * 示例：createModule({ module:'user', title:'用户管理', path:'/users' })
   * 生成：
   *   用户管理（MENU）
   *     ├── 查看用户（BUTTON, code=user:read）
   *     ├── 新建用户（BUTTON, code=user:create）
   *     ├── 编辑用户（BUTTON, code=user:update）
   *     └── 删除用户（BUTTON, code=user:delete）
   */
  async createModule(dto: CreateModuleDto): Promise<MenuTreeNode> {
    const actions = dto.actions ?? [...STANDARD_ACTIONS];

    // 检查是否有权限码冲突
    const codes = actions.map((a) => `${dto.module}:${a}`);
    const conflicts = await this.menuRepo.find({ where: { code: In(codes) } });
    if (conflicts.length) {
      const conflictCodes = conflicts.map((m) => m.code).join(', ');
      throw new ConflictException(`以下权限码已存在：${conflictCodes}`);
    }

    // 1. 创建 MENU 节点
    const menuNode = await this.menuRepo.save(
      this.menuRepo.create({
        title: dto.title,
        type: MenuType.MENU,
        path: dto.path,
        icon: dto.icon ?? null,
        parentId: dto.parentId ?? null,
        sort: dto.sort ?? 0,
        isSystem: dto.isSystem ?? false,
        code: null,
      }),
    );

    // 2. 批量创建 BUTTON 节点
    const buttons = await this.menuRepo.save(
      actions.map((action, index) =>
        this.menuRepo.create({
          title: `${ACTION_LABELS[action]}${dto.title}`,
          type: MenuType.BUTTON,
          path: null,
          icon: null,
          code: `${dto.module}:${action}`,
          parentId: menuNode.id,
          sort: index,
          visible: false, // 按钮节点不在侧边栏显示
          isSystem: dto.isSystem ?? false,
        }),
      ),
    );

    return { ...menuNode, children: buttons.map((b) => ({ ...b, children: [] })) };
  }

  async findOne(id: string): Promise<Menu> {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException(`菜单 ${id} 不存在`);
    return menu;
  }

  /**
   * 获取完整菜单树（管理端用，含 BUTTON 节点）
   * 根节点：parentId = null
   */
  async findTree(): Promise<MenuTreeNode[]> {
    const all = await this.findAll();
    return this.buildTree(all, null);
  }

  // ─── 查询 ────────────────────────────────────────────────────

  async findAll(): Promise<Menu[]> {
    return this.menuRepo.find({ order: { sort: 'ASC', createdAt: 'ASC' } });
  }

  /**
   * 获取可见侧边栏菜单树（仅 DIRECTORY + MENU 类型，visible=true）
   * 用于 /auth/me 返回前端渲染侧边栏
   */
  async findVisibleTree(menuIds?: string[]): Promise<MenuTreeNode[]> {
    let menus = await this.menuRepo.find({
      where: { visible: true },
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
    // 若传入 menuIds，则只返回已授权的菜单
    if (menuIds?.length) {
      menus = menus.filter((m) => menuIds.includes(m.id));
    }

    return this.buildTree(menus, null);
  }

  // ─── 修改 ────────────────────────────────────────────────────

  async update(id: string, dto: UpdateMenuDto): Promise<Menu> {
    const menu = await this.findOne(id);

    // BUTTON 类型：path 和 visible 不允许修改
    if (menu.type === MenuType.BUTTON) {
      delete dto.path;
      delete dto.visible;
    }

    // parentId 归一化
    if ('parentId' in dto) {
      (dto as any).parentId = dto.parentId ?? null;
    }

    if (dto.code && dto.code !== menu.code) {
      const exists = await this.menuRepo.findOne({ where: { code: dto.code } });
      if (exists) throw new ConflictException(`权限码 ${dto.code} 已存在`);
    }
    Object.assign(menu, dto);
    return this.menuRepo.save(menu);
  }

  /**
   * 批量更新 sort 字段（拖拽排序用）
   * @param items [{ id, sort }]
   */
  async updateSort(items: { id: string; sort: number }[]): Promise<void> {
    await Promise.all(items.map(({ id, sort }) => this.menuRepo.update(id, { sort })));
  }

  // ─── 删除 ────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const menu = await this.findOne(id);
    if (menu.isSystem) throw new ConflictException('系统内置菜单不允许删除');
    await this.menuRepo.softRemove(menu);
  }

  // ─── 工具方法 ────────────────────────────────────────────────

  /**
   * 将平铺的菜单列表构建成树结构
   * @param menus 所有菜单（已按 sort 排序）
   * @param parentId 当前层级的父 id
   */
  buildTree(menus: Menu[], parentId: string | null): MenuTreeNode[] {
    return menus
      .filter((m) => m.parentId === parentId)
      .map((m) => ({
        ...m,
        children: this.buildTree(menus, m.id),
      }));
  }
}
