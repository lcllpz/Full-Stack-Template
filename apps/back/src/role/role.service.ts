import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

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

  create(dto: CreateRoleDto) {
    return this.roleRepository.save({
      name: dto.name,
      description: dto.description ?? null,
      isSystem: dto.isSystem ?? false,
    });
  }

  searchList(query: QueryRoleListDto) {
    const { id, name, isSystem } = query;

    const qb = this.roleRepository.createQueryBuilder('role');

    if (id) {
      qb.andWhere('role.id = :id', { id });
    }
    if (name) {
      qb.andWhere('role.name LIKE :name', { name: `%${name}%` });
    }
    if (isSystem !== undefined) {
      qb.andWhere('role.isSystem = :isSystem', { isSystem });
    }

    return qb.getMany();
  }

  async searchPage(query: QueryRolePageDto) {
    const { page = 1, pageSize = 10, name, isSystem } = query;

    const qb = this.roleRepository.createQueryBuilder('role');

    if (name) {
      qb.andWhere('role.name LIKE :name', { name: `%${name}%` });
    }
    if (isSystem !== undefined) {
      qb.andWhere('role.isSystem = :isSystem', { isSystem });
    }

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data: list, total, page, pageSize, totalPage: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`角色 ${id} 不存在`);
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    return this.roleRepository.save({ ...role, ...dto });
  }

  async remove(dto: DeleteRoleDto) {
    if (!dto.ids?.length) {
      return { deleted: 0 };
    }
    await this.roleRepository.softDelete({ id: In(dto.ids) });
    return { deleted: dto.ids.length };
  }
}
