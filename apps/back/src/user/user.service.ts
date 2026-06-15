import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Role } from 'src/role/entities/role.entity';
import { In, Repository } from 'typeorm';

import { CreateUserDto } from './dto/create-user.dto';
import { QueryPageDto } from './dto/query-page-dto';
import { QueryUserListDto } from './dto/query-user-list-dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

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
      const salt = await bcrypt.genSalt(10);
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    const roles = createUserDto.roleIds?.length
      ? await this.roleRepository.findBy({ id: In(createUserDto.roleIds) })
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
      const salt = await bcrypt.genSalt(10);
      dto.password = await bcrypt.hash(dto.password, salt);
    }

    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length
        ? await this.roleRepository.findBy({ id: In(dto.roleIds) })
        : [];
    }

    // ESLint 规则 @typescript-eslint/no-unused-vars 默认会忽略所有以 _ 开头的变量
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { roleIds: _, ...rest } = dto;
    return this.userRepository.save({ ...user, ...rest });
  }

  async remove(ids: string[]) {
    await this.userRepository.softDelete({ id: In(ids) });
    return { deleted: ids.length };
  }
}
