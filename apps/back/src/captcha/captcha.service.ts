import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create as createCaptcha } from 'svg-captcha';

import { AllConfigType } from '@/config/config.type';
import { verificationConfigKey } from '@/config/verification/config';
import { RedisService } from '@/redis/redis.service';

import { captchaKey } from './captcha.constants';

export interface CaptchaResult {
  /** 验证码标识，后续发码请求需回传此 id + 用户识图输入的文本 */
  captchaId: string;
  /** SVG 图片字符串，前端可直接内联渲染 */
  svg: string;
}

@Injectable()
export class CaptchaService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private get config() {
    return this.configService.getOrThrow(verificationConfigKey, { infer: true });
  }

  /** 生成一张 SVG 图形验证码，文本存入 Redis（带 TTL），返回 id 与图片 */
  async generate(): Promise<CaptchaResult> {
    const { CAPTCHA_LENGTH, CAPTCHA_TTL_SECONDS } = this.config;
    const client = this.redisService.getClientOrThrow();

    const captcha = createCaptcha({
      size: CAPTCHA_LENGTH,
      // 干扰线，增加机器识别难度
      noise: 2,
      color: true,
      background: '#f2f2f2',
      // 去掉容易混淆的字符（0/o、1/i/l 等）
      ignoreChars: '0o1ilI',
    });

    const captchaId = randomUUID();
    // 大小写不敏感：统一按小写存储，校验时同样转小写比较
    await client.set(captchaKey(captchaId), captcha.text.toLowerCase(), 'EX', CAPTCHA_TTL_SECONDS);

    return { captchaId, svg: captcha.data };
  }

  /**
   * 校验图形验证码。
   * 无论对错都会删除该验证码（一次性），防止暴力重试与重放。
   */
  async verify(captchaId: string | undefined, text: string | undefined): Promise<boolean> {
    if (!captchaId || !text) {
      return false;
    }
    const client = this.redisService.getClientOrThrow();
    const key = captchaKey(captchaId);

    const stored = await client.get(key);
    if (stored === null) {
      // 不存在或已过期
      return false;
    }
    await client.del(key);

    return stored === text.trim().toLowerCase();
  }
}
