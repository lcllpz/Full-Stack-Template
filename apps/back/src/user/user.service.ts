import { HttpStatus, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

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
    return await this.userRepository.save({
      email,
      password,
      nickname: createUserDto.nickname || null,
      phone: createUserDto.phone || null,
      avatar: createUserDto.avatar || null,
    });
  }

  findByEmail(email: User['email']) {
    return this.userRepository.findOne({ where: { email } });
  }

  findAll() {
    return this.userRepository.find();
  }

  findOne(id: string) {
    return `This action returns a #${id} user`;
  }

  update(id: string) {
    return `This action updates a #${id} user`;
  }

  remove(id: string) {
    return `This action removes a #${id} user`;
  }
}
