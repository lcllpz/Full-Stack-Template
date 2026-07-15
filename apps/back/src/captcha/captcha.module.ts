import { Module } from '@nestjs/common';

import { CaptchaController } from './captcha.controller';
import { CaptchaService } from './captcha.service';

// RedisService 由全局 RedisModule 提供，ConfigService 全局可用，无需在此 import
@Module({
  controllers: [CaptchaController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
