import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { MailService } from '@/mail/mail.service';

import { JOB_SEND_EMAIL_CODE, MAIL_QUEUE, SendEmailCodeJobData } from '../queue.constants';

// 消费 mail 队列：目前只有「发送邮箱验证码」一类 Job
@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendEmailCodeJobData>): Promise<void> {
    switch (job.name) {
      case JOB_SEND_EMAIL_CODE: {
        const { to, code, purpose } = job.data;
        await this.mailService.sendVerificationCode(to, code, purpose);
        return;
      }
      default:
        // 未知 Job：抛错让 BullMQ 记录失败，避免静默吞掉
        throw new Error(`未知的邮件 Job 类型: ${job.name}`);
    }
  }
}
