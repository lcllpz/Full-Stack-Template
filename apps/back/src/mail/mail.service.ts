import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

import { AllConfigType } from '@/config/config.type';
import { mailConfigKey } from '@/config/mail/config';
import { verificationConfigKey } from '@/config/verification/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** 懒初始化的 SMTP 传输器，仅在配置了 SMTP 时创建 */
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  private get config() {
    return this.configService.getOrThrow(mailConfigKey, { infer: true });
  }

  /** 未配置 SMTP（开发环境）时返回 false，验证码将改为打印到日志 */
  private get isConfigured(): boolean {
    const { MAIL_HOST, MAIL_USER, MAIL_PASSWORD } = this.config;
    return Boolean(MAIL_HOST && MAIL_USER && MAIL_PASSWORD);
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const { MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASSWORD } = this.config;
      this.transporter = createTransport({
        host: MAIL_HOST,
        port: MAIL_PORT,
        secure: MAIL_SECURE,
        auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
      });
    }
    return this.transporter;
  }

  /**
   * 发送验证码邮件。
   * 开发环境未配置 SMTP 时不真正发信，直接把验证码打印到日志，方便本地联调。
   */
  async sendVerificationCode(to: string, code: string, purpose = '验证码'): Promise<void> {
    const ttlMinutes = Math.round(
      this.configService.getOrThrow(verificationConfigKey, { infer: true }).CODE_TTL_SECONDS / 60,
    );

    if (!this.isConfigured) {
      this.logger.warn(
        `[DEV] 未配置 SMTP，邮件验证码不实际发送 → to=${to} code=${code} 用途=${purpose}`,
      );
      return;
    }
    const { MAIL_FROM, MAIL_FROM_NAME } = this.config;

    try {
      await this.getTransporter().sendMail({
        from: `"${MAIL_FROM_NAME}" <${MAIL_FROM}>`,
        to,
        subject: `【${MAIL_FROM_NAME}】${purpose}`,
        text: `您的${purpose}是：${code}，${ttlMinutes} 分钟内有效。请勿泄露给他人。`,
        html: `
          <div style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #333;">
            <p>您的${purpose}为：</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1a73e8;">${code}</p>
            <p style="color: #888;">验证码 ${ttlMinutes} 分钟内有效，请勿泄露给他人。</p>
          </div>`,
      });
    } catch (error) {
      console.log('sendVerificationCode->>>>>>>>>>>>>>>>>>>>error', error);
      throw new NotFoundException(error as string);
    }
    // this.logger.log(`邮件验证码已发送 → to=${to} 用途=${purpose}`);
  }
}
