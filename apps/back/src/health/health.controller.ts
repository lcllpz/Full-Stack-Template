import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/auth/guards/jwt-auth.guard';
import { SkipPermissions } from '@/permission/permissions.decorator';

@ApiTags('健康检查')
@Public()
@SkipPermissions()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ security: [] })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
