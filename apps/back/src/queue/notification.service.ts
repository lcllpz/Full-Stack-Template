import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  JOB_SEND_EMAIL_CODE,
  JOB_SEND_SMS_CODE,
  MAIL_QUEUE,
  SendEmailCodeJobData,
  SendSmsCodeJobData,
  SMS_QUEUE,
} from './queue.constants';

/**
 * 通知生产者：把「发送验证码」动作投递到队列，由对应 processor 异步消费。
 * 业务层（AuthService）只需调用这里的 enqueue 方法，不感知发送细节与重试。
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue<SendEmailCodeJobData>,
    @InjectQueue(SMS_QUEUE) private readonly smsQueue: Queue<SendSmsCodeJobData>,
  ) {}

  /** 失败自动重试 3 次（指数退避），成功/失败都只保留最近少量记录，避免 Redis 堆积 */
  private readonly defaultJobOptions = {
    attempts: 3,
    // 重试间隔
    backoff: { type: 'exponential' as const, delay: 2000 },
    // 成功任务只保留最近 50 条，更早的从 Redis 删掉
    removeOnComplete: 50,
    // 失败任务只保留最近 100 条
    removeOnFail: 100,
  };

  async enqueueEmailCode(to: string, code: string, purpose = '验证码'): Promise<void> {
    await this.mailQueue.add(JOB_SEND_EMAIL_CODE, { to, code, purpose }, this.defaultJobOptions);
  }

  async enqueueSmsCode(phone: string, code: string, purpose = '验证码'): Promise<void> {
    await this.smsQueue.add(JOB_SEND_SMS_CODE, { phone, code, purpose }, this.defaultJobOptions);
  }
}
