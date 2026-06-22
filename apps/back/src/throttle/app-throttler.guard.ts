import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  /**
   * 已登录用户按 userId 计数，避免同一 NAT 下互相影响；
   * 未登录请求按客户端 IP 计数（兼容 x-forwarded-for）。
   */
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return Promise.resolve(user.userId);
    }

    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const ip = forwarded.split(',')[0]?.trim();
      if (ip) return Promise.resolve(ip);
    }

    const socket = req.socket as { remoteAddress?: string } | undefined;
    const ip = (req.ip ?? socket?.remoteAddress ?? 'unknown') as string;
    return Promise.resolve(ip);
  }
}
