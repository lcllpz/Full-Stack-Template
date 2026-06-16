import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MenuModule } from '@/menu/menu.module';
import { PermissionModule } from '@/permission/permission.module';
import { RoleModule } from '@/role/role.module';

import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MenuModule,
    forwardRef(() => RoleModule),
    forwardRef(() => PermissionModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
