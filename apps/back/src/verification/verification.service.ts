import { createHmac, randomInt } from 'node:crypto';

import {
  HttpException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { authConfigKey } from '@/config/auth/config';
import { AllConfigType } from '@/config/config.type';
import { verificationConfigKey } from '@/config/verification/config';
import { RedisService } from '@/redis/redis.service';

import {
  codeKey,
  dailyKey,
  lockKey,
  ONE_DAY_SECONDS,
  StoredCode,
  VerifyScene,
} from './verification.constants';

@Injectable()
export class VerificationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private get config() {
    return this.configService.getOrThrow(verificationConfigKey, { infer: true });
  }

  /** 用 JWT_SECRET 作为哈希 pepper，避免直接暴露可反查的纯哈希 */
  private get pepper(): string {
    return this.configService.getOrThrow(authConfigKey, { infer: true }).JWT_SECRET;
  }

  /**
   * 生成并存储验证码，返回明文验证码（供上层通过邮件/短信发送）。
   * 内含风控：发送频率锁 + 单日发送上限。
   *
   * @param scene  验证码场景（严格隔离）
   * @param target 目标标识：邮箱地址或手机号
   */
  async issueCode(scene: VerifyScene, target: string): Promise<string> {
    const client = this.redisService.getClientOrThrow();
    const { CODE_LENGTH, CODE_TTL_SECONDS, SEND_INTERVAL_SECONDS, DAILY_LIMIT } = this.config;
    // 1) 发送频率：用 SET NX 抢占锁，抢不到说明处于最小间隔内
    // 'NX' 是 Redis SET 的选项，意思是：Only set if Not eXists —— 键不存在时才写入，已存在则不改、返回 null。
    if (SEND_INTERVAL_SECONDS > 0) {
      const locked = await client.set(
        lockKey(scene, target),
        '1',
        'EX',
        SEND_INTERVAL_SECONDS,
        'NX',
      );
      if (locked === null) {
        throw new HttpException(
          `验证码发送过于频繁，请 ${SEND_INTERVAL_SECONDS}s 后再试`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2) 单日上限：按天计数，首次计数时设置 24h 过期
    // incr 是 Redis 的 原子自增：键不存在时先当 0，再 +1，返回新值
    const dKey = dailyKey(scene, target, this.today());
    const count = await client.incr(dKey);
    if (count === 1) {
      await client.expire(dKey, ONE_DAY_SECONDS);
    }

    if (count > DAILY_LIMIT) {
      throw new HttpException('今日验证码发送次数已达上限', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 3) 生成纯数字验证码（crypto 安全随机）
    const code = this.generateNumericCode(CODE_LENGTH);

    // 4) 哈希后存储（明文不落 Redis），attempts 记录错误次数
    const payload: StoredCode = { codeHash: this.hash(code, scene, target), attempts: 0 };
    await client.set(codeKey(scene, target), JSON.stringify(payload), 'EX', CODE_TTL_SECONDS);

    return code;
  }

  /**
   * 校验验证码：
   * - 成功：立即删除（防重放）
   * - 失败：累计错误次数，达到上限即作废，需重新获取
   * 校验不通过统一抛 422，错误信息放在 errors.code。
   */
  async verifyCode(scene: VerifyScene, target: string, code: string): Promise<void> {
    const client = this.redisService.getClientOrThrow();
    const { MAX_ATTEMPTS } = this.config;
    const key = codeKey(scene, target);

    const raw = await client.get(key);
    if (!raw) {
      throw this.invalidCodeError('验证码无效或已过期，请重新获取');
    }

    const data = JSON.parse(raw) as StoredCode;

    // 命中：一次性使用，删除后返回
    if (data.codeHash === this.hash(code, scene, target)) {
      await client.del(key);
      return;
    }

    // 未命中：错误次数 +1
    const attempts = data.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await client.del(key);
      throw this.invalidCodeError('验证码错误次数过多，请重新获取');
    }
    // KEEPTTL：更新错误次数但保留原有剩余有效期
    const next: StoredCode = { ...data, attempts };
    await client.set(key, JSON.stringify(next), 'KEEPTTL');
    throw this.invalidCodeError('验证码错误');
  }

  /** 生成指定位数的纯数字验证码，不足位数左侧补零 */
  private generateNumericCode(length: number): string {
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }

  /** 绑定 scene + target 的 HMAC 哈希，防止跨场景/跨目标撞哈希 */
  private hash(code: string, scene: VerifyScene, target: string): string {
    return createHmac('sha256', this.pepper).update(`${scene}:${target}:${code}`).digest('hex');
  }

  /** 本地日期 yyyymmdd，作为单日计数键的一部分 */
  private today(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private invalidCodeError(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { code: message },
    });
  }
}
