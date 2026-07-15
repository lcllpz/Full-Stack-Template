import { Module } from '@nestjs/common';

import { VerificationService } from './verification.service';

// RedisService（全局 RedisModule 提供）+ ConfigService（全局）即可满足依赖
@Module({
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
