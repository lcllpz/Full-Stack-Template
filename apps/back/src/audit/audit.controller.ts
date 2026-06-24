import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@/permission/permission.constants';
import { Permissions } from '@/permission/permissions.decorator';

import { QueryAuditPageDto } from './dto/query-audit-page.dto';
import { AuditService } from './audit.service';

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
