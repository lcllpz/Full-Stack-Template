import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@/permission/permission.constants';
import { Permissions } from '@/permission/permissions.decorator';
import { PermissionsGuard } from '@/permission/permissions.guard';
import { SWAGGER_BEARER_AUTH } from '@/swagger/swagger.constants';

import { QueryAuditPageDto } from './dto/query-audit-page.dto';
import { AuditService } from './audit.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@ApiTags('审计日志')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** 分页查询操作审计日志 */
  @Get('page')
  @Permissions(PERMISSIONS.SYSTEM_LOG)
  findPage(@Query() query: QueryAuditPageDto) {
    return this.auditService.searchPage(query);
  }
}
