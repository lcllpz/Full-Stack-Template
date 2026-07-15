import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { authConfigKey } from '@/config/auth/config';
import { verificationConfigKey } from '@/config/verification/config';
import { RedisService } from '@/redis/redis.service';

import { VerifyScene } from './verification.constants';
import { VerificationService } from './verification.service';

/**
 * 极简内存版 ioredis，仅实现 VerificationService 用到的命令语义：
 * set(含 EX/NX/KEEPTTL) / get / del / incr / expire。
 * 不模拟真实 TTL 过期（单测不等待时间）。
 */
class FakeRedis {
  private store = new Map<string, string>();

  set(key: string, value: string, ...args: unknown[]): 'OK' | null {
    // 处理 NX：键已存在则不设置，返回 null（用于发送频率锁）
    if (args.includes('NX') && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    return 'OK';
  }

  get(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  del(key: string): number {
    return this.store.delete(key) ? 1 : 0;
  }

  incr(key: string): number {
    const next = parseInt(this.store.get(key) ?? '0', 10) + 1;
    this.store.set(key, String(next));
    return next;
  }

  expire(): number {
    return 1;
  }
}

function buildService(overrides?: {
  sendInterval?: number;
  dailyLimit?: number;
  maxAttempts?: number;
  codeLength?: number;
}) {
  const fake = new FakeRedis();
  const redisService = {
    getClientOrThrow: () => fake,
  } as unknown as RedisService;

  const verificationConfig = {
    CODE_LENGTH: overrides?.codeLength ?? 6,
    CODE_TTL_SECONDS: 300,
    SEND_INTERVAL_SECONDS: overrides?.sendInterval ?? 60,
    MAX_ATTEMPTS: overrides?.maxAttempts ?? 5,
    DAILY_LIMIT: overrides?.dailyLimit ?? 10,
    CAPTCHA_LENGTH: 4,
    CAPTCHA_TTL_SECONDS: 120,
  };

  const configService = {
    getOrThrow: (key: string) =>
      key === verificationConfigKey
        ? verificationConfig
        : key === authConfigKey
          ? { JWT_SECRET: 'test-secret' }
          : {},
  } as unknown as ConfigService;

  return { service: new VerificationService(redisService, configService as never), fake };
}

describe('VerificationService', () => {
  it('issueCode 生成指定位数的纯数字验证码', async () => {
    const { service } = buildService({ codeLength: 6 });
    const code = await service.issueCode(VerifyScene.REGISTER, 'a@a.com');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('正确验证码校验通过，且一次性（再次校验失败）', async () => {
    const { service } = buildService();
    const code = await service.issueCode(VerifyScene.REGISTER, 'a@a.com');

    await expect(
      service.verifyCode(VerifyScene.REGISTER, 'a@a.com', code),
    ).resolves.toBeUndefined();
    // 已删除，重放应失败
    await expect(service.verifyCode(VerifyScene.REGISTER, 'a@a.com', code)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('错误验证码累计次数，达到上限后作废', async () => {
    const { service } = buildService({ maxAttempts: 3, sendInterval: 0 });
    await service.issueCode(VerifyScene.LOGIN_EMAIL, 'b@b.com');

    // 前 2 次错误：提示"验证码错误"
    for (let i = 0; i < 2; i++) {
      await expect(
        service.verifyCode(VerifyScene.LOGIN_EMAIL, 'b@b.com', '000000'),
      ).rejects.toThrow();
    }
    // 第 3 次达到上限：作废
    await expect(
      service.verifyCode(VerifyScene.LOGIN_EMAIL, 'b@b.com', '000000'),
    ).rejects.toThrow();
    // 作废后，即使输入正确的原验证码也失败（键已删）
    await expect(
      service.verifyCode(VerifyScene.LOGIN_EMAIL, 'b@b.com', '123456'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('发送频率锁：间隔内重复发送抛 429', async () => {
    const { service } = buildService({ sendInterval: 60 });
    await service.issueCode(VerifyScene.RESET_PWD_EMAIL, 'c@c.com');
    await expect(service.issueCode(VerifyScene.RESET_PWD_EMAIL, 'c@c.com')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('单日上限：超过 DAILY_LIMIT 抛 429', async () => {
    const { service } = buildService({ sendInterval: 0, dailyLimit: 3 });
    for (let i = 0; i < 3; i++) {
      await service.issueCode(VerifyScene.LOGIN_PHONE, '13800000000');
    }
    await expect(service.issueCode(VerifyScene.LOGIN_PHONE, '13800000000')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('场景隔离：不同 scene 的验证码互不通用', async () => {
    const { service } = buildService({ sendInterval: 0 });
    const code = await service.issueCode(VerifyScene.REGISTER, 'd@d.com');
    // 用注册验证码去校验"登录"场景应失败
    await expect(
      service.verifyCode(VerifyScene.LOGIN_EMAIL, 'd@d.com', code),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
