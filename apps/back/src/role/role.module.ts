import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Menu } from '@/menu/entities/menu.entity';
import { PermissionModule } from '@/permission/permission.module';
import { PermissionMenuCacheModule } from '@/redis/permissionMenuCache';
import { UserModule } from '@/user/user.module';

import { Role } from './entities/role.entity';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Menu]),
    PermissionMenuCacheModule,
    forwardRef(() => UserModule),
    PermissionModule,
  ],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
