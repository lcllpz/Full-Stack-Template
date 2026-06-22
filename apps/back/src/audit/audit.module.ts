import { forwardRef, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionModule } from '@/permission/permission.module';

import { AuditLog } from './entities/audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditContextInterceptor } from './audit-context.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), forwardRef(() => PermissionModule)],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
