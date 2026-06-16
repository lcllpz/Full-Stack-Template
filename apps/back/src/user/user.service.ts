import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';

import { authConfigKey } from '@/config/auth/config';
import { AuthConfigType } from '@/config/auth/config.type';
import { AllConfigType } from '@/config/config.type';
import { MenuType } from '@/menu/entities/menu.entity';
import { MenuService, MenuTreeNode } from '@/menu/menu.service';
import { RoleService } from '@/role/role.service';

import { CreateUserDto } from './dto/create-user.dto';
import { QueryPageDto } from './dto/query-page-dto';
import { QueryUserListDto } from './dto/query-user-list-dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  constructor(
    private readonly menuService: MenuService,
    private readonly roleService: RoleService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private get bcryptSaltRounds(): number {
    return this.configService.getOrThrow<AuthConfigType>(authConfigKey, { infer: true })
      .BCRYPT_SALT_ROUNDS;
  }

  async create(createUserDto: CreateUserDto) {
    let email = '';
    if (createUserDto.email) {
      const user = await this.findByEmail(createUserDto.email);
      if (user) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
      email = createUserDto.email;
    }
    let password = '';
    if (createUserDto.password) {
      const salt = await bcrypt.genSalt(this.bcryptSaltRounds);
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    const roles = createUserDto.roleIds?.length
      ? await this.roleService.findByIds(createUserDto.roleIds)
      : [];

    return await this.userRepository.save({
      email,
      password,
      nickname: createUserDto.nickname || null,
      phone: createUserDto.phone || null,
      avatar: createUserDto.avatar || null,
      roles,
    });
  }

  findByEmail(email: User['email']) {
    return this.userRepository.findOne({ where: { email } });
  }

  searchList(query: QueryUserListDto) {
    const { nickname, email, phone, id, roleCode } = query;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');

    if (nickname) {
      qb.andWhere('user.nickname LIKE :nickname', { nickname: `%${nickname}%` });
    }
    if (email) {
      qb.andWhere('user.email LIKE :email', { email: `%${email}%` });
    }
    if (phone) {
      qb.andWhere('user.phone LIKE :phone', { phone: `%${phone}%` });
    }
    if (roleCode) {
      qb.andWhere('role.code LIKE :roleCode', { roleCode: `%${roleCode}%` });
    }
    if (id) {
      qb.andWhere('user.id = :id', { id });
    }

    return qb.getMany();
  }

  async searchPage(query: QueryPageDto) {
    const { page = 1, pageSize = 10, nickname, email, phone, roleCode } = query;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');

    if (nickname) {
      qb.andWhere('user.nickname LIKE :nickname', { nickname: `%${nickname}%` });
    }
    if (email) {
      qb.andWhere('user.email LIKE :email', { email: `%${email}%` });
    }
    if (phone) {
      qb.andWhere('user.phone LIKE :phone', { phone: `%${phone}%` });
    }
    if (roleCode?.length) {
      qb.andWhere('role.code IN (:...roleCode)', { roleCode });
    }

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data: list, total, page, pageSize, totalPage: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const exists = await this.findByEmail(dto.email);
      if (exists) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: 'emailAlreadyExists' },
        });
      }
    }

    if (dto.password) {
      const salt = await bcrypt.genSalt(this.bcryptSaltRounds);
      dto.password = await bcrypt.hash(dto.password, salt);
    }

    if (dto.roleIds !== undefined) {
      user.roles = await this.roleService.findByIds(dto.roleIds);
    }

    // ESLint 规则 @typescript-eslint/no-unused-vars 默认会忽略所有以 _ 开头的变量
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { roleIds: _roleIds, ...rest } = dto;
    return this.userRepository.save({ ...user, ...rest });
  }

  async remove(ids: string[]) {
    await this.userRepository.softDelete({ id: In(ids) });
    return { deleted: ids.length };
  }

  // ─── 权限查询 ────────────────────────────────────────────

  /**
   * 获取用户全部权限码（BUTTON 类型菜单的 code）
   * 链路：User → user_roles → Role → role_menus → Menu(type=BUTTON) → code
   */
  async getPermissionCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { roles: { menus: true } },
    });
    if (!user) return [];

    const codes = new Set<string>();
    for (const role of user.roles ?? []) {
      for (const menu of role.menus ?? []) {
        if (menu.type === MenuType.BUTTON && menu.code) {
          codes.add(menu.code);
        }
      }
    }
    return [...codes];
  }

  /**
   * 获取用户可见的侧边栏菜单树（DIRECTORY + MENU 类型，visible=true）
   * 根据角色关联的菜单过滤，返回树结构
   */
  async getAccessibleMenuTree(userId: string): Promise<MenuTreeNode[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { roles: { menus: true } },
    });
    if (!user) return [];

    // 收集所有角色关联的 DIRECTORY/MENU 类型可见菜单 id
    const visibleMenuIds = new Set<string>();
    for (const role of user.roles ?? []) {
      for (const menu of role.menus ?? []) {
        if (menu.type !== MenuType.BUTTON && menu.visible) {
          visibleMenuIds.add(menu.id);
        }
      }
    }
    const ids = [...visibleMenuIds];
    if (ids.length) {
      // 复用 MenuService.findVisibleTree 构建树
      return this.menuService.findVisibleTree(ids);
    }
    return [];
  }

  /** 获取用户角色名称列表 */
  async getRoleNames(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    return (user?.roles ?? []).map((r) => r.name);
  }
}
