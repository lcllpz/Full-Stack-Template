import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AuditService, sanitizeAuditSnapshot } from '@/audit/audit.service';
import { Menu, MenuType } from '@/menu/entities/menu.entity';
import { PERMISSIONS } from '@/permission/permission.constants';
import { PermissionMenuCacheService } from '@/redis/permissionMenuCache';

import { CreateRoleDto } from './dto/create-role.dto';
import { DeleteRoleDto } from './dto/delete-role.dto';
import { QueryRoleListDto } from './dto/query-role-list.dto';
import { QueryRolePageDto } from './dto/query-role-page.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';

@Injectable()
export class RoleService {
  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @InjectRepository(Menu)
  private readonly menuRepository: Repository<Menu>;

  constructor(
    private readonly permissionMenuCacheService: PermissionMenuCacheService,
    private readonly auditService: AuditService,
  ) {}

  // ─── 创建 ────────────────────────────────────────────────

  async create(dto: CreateRoleDto): Promise<Role> {
    const role = this.roleRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      isSystem: dto.isSystem ?? false,
    });

    if (dto.menuIds !== undefined) {
      role.menus = await this.resolveMenusWithDescendants(dto.menuIds);
    }

    const saved = await this.roleRepository.save(role);

    this.auditService.log({
      action: PERMISSIONS.ROLE_CREATE,
      resourceId: saved.id,
      detail: {
        after: sanitizeAuditSnapshot({
          ...saved,
          menuIds: saved.menus?.map((m) => m.id) ?? [],
        } as unknown as Record<string, unknown>),
      },
    });

    return saved;
  }

  // ─── 查询 ────────────────────────────────────────────────

  searchList(query: QueryRoleListDto) {
    const { id, name, isSystem } = query;

    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.menus', 'menu');

    if (id) qb.andWhere('role.id = :id', { id });
    if (name) qb.andWhere('role.name LIKE :name', { name: `%${name}%` });
    if (isSystem !== undefined) qb.andWhere('role.isSystem = :isSystem', { isSystem });

    return qb.getMany();
  }

  async searchPage(query: QueryRolePageDto) {
    const { page = 1, pageSize = 10, name, isSystem } = query;

    const qb = this.roleRepository.createQueryBuilder('role');

    if (name) qb.andWhere('role.name LIKE :name', { name: `%${name}%` });
    if (isSystem !== undefined) qb.andWhere('role.isSystem = :isSystem', { isSystem });

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data: list, total, page, pageSize, totalPage: Math.ceil(total / pageSize) };
  }

  /** 根据 id 列表批量查询角色 */
  findByIds(ids: string[]): Promise<Role[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.roleRepository.findBy({ id: In(ids) });
  }

  /** 查询单个角色（含绑定菜单） */
  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: { menus: true },
    });
    if (!role) throw new NotFoundException(`角色 ${id} 不存在`);

    // 菜单按 sort 排序后返回
    role.menus = role.menus.sort((a, b) => a.sort - b.sort);
    return role;
  }

  // ─── 更新 ────────────────────────────────────────────────

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    const before = sanitizeAuditSnapshot({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      menuIds: role.menus.map((m) => m.id),
    } as unknown as Record<string, unknown>);

    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description ?? null;
    if (dto.isSystem !== undefined) role.isSystem = dto.isSystem;

    // menuIds 传入时更新菜单绑定（传空数组 = 清空）
    if (dto.menuIds !== undefined) {
      role.menus = await this.resolveMenusWithDescendants(dto.menuIds);
    }

    const saved = await this.roleRepository.save(role);

    if (dto.menuIds !== undefined) {
      await this.permissionMenuCacheService.invalidateByRoleId(id);
    }

    this.auditService.log({
      action: dto.menuIds !== undefined ? PERMISSIONS.ROLE_ASSIGN : PERMISSIONS.ROLE_UPDATE,
      resourceId: id,
      detail: {
        before,
        after: sanitizeAuditSnapshot({
          id: saved.id,
          name: saved.name,
          description: saved.description,
          isSystem: saved.isSystem,
          menuIds: saved.menus?.map((m) => m.id) ?? [],
        } as unknown as Record<string, unknown>),
      },
    });

    return saved;
  }

  // ─── 删除 ────────────────────────────────────────────────

  async remove(dto: DeleteRoleDto) {
    if (!dto.ids?.length) return { deleted: 0 };

    const roles = await this.roleRepository.findBy({ id: In(dto.ids) });

    await Promise.all(
      dto.ids.map((roleId) => this.permissionMenuCacheService.invalidateByRoleId(roleId)),
    );
    await this.roleRepository.softDelete({ id: In(dto.ids) });

    this.auditService.log({
      action: PERMISSIONS.ROLE_DELETE,
      resourceId: dto.ids.length === 1 ? dto.ids[0] : null,
      detail: {
        ids: dto.ids,
        before: roles.map((r) =>
          sanitizeAuditSnapshot({
            id: r.id,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
          } as unknown as Record<string, unknown>),
        ),
      },
    });

    return { deleted: dto.ids.length };
  }

  // ─── 权限查询（供 UserService / PermissionsGuard 调用）────

  /** 查询角色拥有的权限码集合（仅 BUTTON 类型） */
  async getPermissionCodesByRoleId(roleId: string): Promise<string[]> {
    const role = await this.findOne(roleId);
    return role.menus
      .filter((m) => m.type === MenuType.BUTTON && m.code)
      .map((m) => m.code as string);
  }

  // ─── 私有工具 ────────────────────────────────────────────

  /**
   * 根据传入的 menuIds，递归补全所有后代节点
   * 保证父节点选中后子节点自动关联，菜单树完整
   */
  private async resolveMenusWithDescendants(menuIds: string[]): Promise<Menu[]> {
    if (!menuIds.length) return [];

    const allMenus = await this.menuRepository.find();
    const fullIds = new Set(menuIds);

    const addDescendants = (parentId: string) => {
      allMenus
        .filter((m) => m.parentId === parentId)
        .forEach((child) => {
          fullIds.add(child.id);
          addDescendants(child.id);
        });
    };
    menuIds.forEach((id) => addDescendants(id));

    return allMenus.filter((m) => fullIds.has(m.id));
  }
}
