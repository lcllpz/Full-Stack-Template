import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionModule } from '@/permission/permission.module';
import { PermissionMenuCacheModule } from '@/redis/permissionMenuCache';

import { Menu } from './entities/menu.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [TypeOrmModule.forFeature([Menu]), PermissionMenuCacheModule, PermissionModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
