import { forwardRef, Module } from '@nestjs/common';

import { UserModule } from '@/user/user.module';

import { PermissionsGuard } from './permissions.guard';

// PermissionModule 不仅提供 Guard，还把 UserModule 再导出给上层模块：不然使用 PermissionsGuard 都要手动引入 UserModule。
@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard, forwardRef(() => UserModule)],
})
export class PermissionModule {}
