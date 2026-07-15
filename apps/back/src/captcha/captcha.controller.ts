import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '@/auth/guards/jwt-auth.guard';
import { SkipPermissions } from '@/permission/permissions.decorator';
import { THROTTLE_LIMIT_AUTH, THROTTLE_TTL_MS } from '@/throttle/throttle.constants';

import { CaptchaService } from './captcha.service';

@ApiTags('认证')
@SkipPermissions()
@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  // 获取图形验证码：返回 { captchaId, svg }
  // 前端渲染 svg，用户识图后连同 captchaId 一起提交到各「发送验证码」接口
  @Get()
  @Public()
  @ApiOperation({ summary: '获取图形验证码', security: [] })
  @Throttle({ default: { limit: THROTTLE_LIMIT_AUTH, ttl: THROTTLE_TTL_MS } })
  generate() {
    return this.captchaService.generate();
  }
}
