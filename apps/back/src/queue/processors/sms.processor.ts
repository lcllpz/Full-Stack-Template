import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { SmsService } from '@/sms/sms.service';

import { JOB_SEND_SMS_CODE, SendSmsCodeJobData, SMS_QUEUE } from '../queue.constants';

// 消费 sms 队列：目前只有「发送手机验证码」一类 Job
@Processor(SMS_QUEUE)
export class SmsProcessor extends WorkerHost {
  constructor(private readonly smsService: SmsService) {
    super();
  }

  async process(job: Job<SendSmsCodeJobData>): Promise<void> {
    switch (job.name) {
      case JOB_SEND_SMS_CODE: {
        const { phone, code, purpose } = job.data;
        await this.smsService.sendVerificationCode(phone, code, purpose);
        return;
      }
      default:
        throw new Error(`未知的短信 Job 类型: ${job.name}`);
    }
  }
}
