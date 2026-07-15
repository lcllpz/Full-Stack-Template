import { Module } from '@nestjs/common';

import { MailService } from './mail.service';

// ConfigService 全局可用；MailService 负责真正的 SMTP 发信
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
