import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { authConfigKey } from '@/config/auth/config';
import { AuthConfigType } from '@/config/auth/config.type';
import { AllConfigType } from '@/config/config.type';
import { redisConfigKey } from '@/config/redis/config';
import { RedisConfigType } from '@/config/redis/config.type';
import {
  buildUserMenusKey,
  buildUserPermsKey,
  PERMISSION_CACHE_FALLBACK_TTL_SECONDS,
} from '@/config/redis/constants';
import { Menu } from '@/menu/entities/menu.entity';
import { User } from '@/user/entities/user.entity';

import { RedisService } from '../redis.service';

/** 菜单树节点（与 MenuService.MenuTreeNode 结构一致，避免循环依赖） */
type MenuTreeNode = Omit<Menu, 'roles'> & { children: MenuTreeNode[] };

/** 将 JWT expiresIn（如 15m、7d）转为秒，用于默认缓存 TTL */
function parseExpiresInToSeconds(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return PERMISSION_CACHE_FALLBACK_TTL_SECONDS;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}

/**
 * 用户权限码 / 可见菜单树的 Redis 缓存层（Cache-Aside 模式）
 *
 * - 读：先查 Redis，miss 时通过 loader 回调查库并回填
 * - 写：不直接更新 Redis，由 Role / Menu / User 变更后调用 invalidate* 删除 key
 * - 降级：REDIS_ENABLED=false 或连接失败时，RedisService 空操作，始终走 loader
 *
 * Key 规范见 config/redis/constants.ts：
 *   fst:user_perms:{userId}  → 权限码数组
 *   fst:user_menus:{userId}  → 侧边栏菜单树
 */
@Injectable()
export class PermissionMenuCacheService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * 缓存 TTL（秒）
   * 优先级：REDIS_PERMISSION_CACHE_TTL_SECONDS > JWT_EXPIRES_IN 解析值 > 900s 兜底
   */
  private get ttlSeconds(): number {
    const redisConfig = this.configService.getOrThrow<RedisConfigType>(redisConfigKey, {
      infer: true,
    });
    if (redisConfig.PERMISSION_CACHE_TTL_SECONDS) {
      return redisConfig.PERMISSION_CACHE_TTL_SECONDS;
    }

    const authConfig = this.configService.getOrThrow<AuthConfigType>(authConfigKey, {
      infer: true,
    });
    return parseExpiresInToSeconds(String(authConfig.JWT_EXPIRES_IN));
  }

  // ─── 读取（Cache-Aside）────────────────────────────────────

  /**
   * 获取用户权限码（BUTTON 类型 menu.code 集合）
   * @param loader 缓存 miss 时的查库函数，由 UserService 注入，避免本类依赖 UserService 产生循环引用
   */
  async getPermissionCodes(userId: string, loader: () => Promise<string[]>): Promise<string[]> {
    const key = buildUserPermsKey(userId);
    const cached = await this.redisService.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        // 脏数据：删除后走 loader 重建
        await this.redisService.del([key]);
      }
    }

    const codes = await loader();
    await this.redisService.set(key, JSON.stringify(codes), this.ttlSeconds);
    return codes;
  }

  /**
   * 获取用户可见菜单树（/auth/me 侧边栏用）
   * @param loader 缓存 miss 时的查库函数，由 UserService 注入
   */
  async getAccessibleMenuTree(
    userId: string,
    loader: () => Promise<MenuTreeNode[]>,
  ): Promise<MenuTreeNode[]> {
    const key = buildUserMenusKey(userId);
    const cached = await this.redisService.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as MenuTreeNode[];
      } catch {
        await this.redisService.del([key]);
      }
    }

    const menus = await loader();
    await this.redisService.set(key, JSON.stringify(menus), this.ttlSeconds);
    return menus;
  }

  // ─── 失效（角色 / 菜单 / 用户变更后主动 DEL）────────────────

  /** 清除指定用户的权限码 + 菜单树缓存（用户角色变更、用户删除时调用） */
  async invalidateUser(userId: string): Promise<void> {
    await this.redisService.del([buildUserPermsKey(userId), buildUserMenusKey(userId)]);
  }

  /** 角色菜单绑定变更或角色删除时，清除该角色下所有用户的缓存 */
  async invalidateByRoleId(roleId: string): Promise<void> {
    const userIds = await this.findUserIdsByRoleId(roleId);
    await this.invalidateUsers(userIds);
  }

  /** 菜单修改 / 删除 / 排序时，清除关联到该菜单的所有用户的缓存 */
  async invalidateByMenuId(menuId: string): Promise<void> {
    const userIds = await this.findUserIdsByMenuId(menuId);
    await this.invalidateUsers(userIds);
  }

  /** 批量删除多个用户的 perms + menus 缓存 key */
  private async invalidateUsers(userIds: string[]): Promise<void> {
    if (!userIds.length) return;

    const keys = userIds.flatMap((userId) => [
      buildUserPermsKey(userId),
      buildUserMenusKey(userId),
    ]);
    await this.redisService.del(keys);
  }

  /** 查询拥有指定角色的用户 id 列表（用于批量失效） */
  private async findUserIdsByRoleId(roleId: string): Promise<string[]> {
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.id = :roleId', { roleId })
      .select('user.id', 'id')
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  /**
   * 查询通过 role_menus 关联到指定菜单的用户 id 列表
   * 链路：User → user_roles → Role → role_menus → Menu
   */
  private async findUserIdsByMenuId(menuId: string): Promise<string[]> {
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .innerJoin('role.menus', 'menu')
      .where('menu.id = :menuId', { menuId })
      .select('user.id', 'id')
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }
}
