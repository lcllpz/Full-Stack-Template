import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '@/user/entities/user.entity';

import { PermissionMenuCacheService } from './permission-menu-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [PermissionMenuCacheService],
  exports: [PermissionMenuCacheService],
})
export class PermissionMenuCacheModule {}
