import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { Logger } from 'winston';

import { AllConfigType } from '@/config/config.type';
import { loggerConfigKey } from '@/config/logger/config';
import { WINSTON_LOGGER } from '@/logger/logger.constants';

const CONTEXT = 'HTTP';

/**
 * HTTP 访问日志拦截器（管观察和记访问信息）：记录每个请求的 method/url/status/耗时/ip/userAgent/userId
 * - 慢请求（超过 LOG_SLOW_MS）以 warn 记录
 * - 出错请求也会补一条访问日志（错误详情由 AllExceptionsFilter 负责）
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly enabled: boolean;
  private readonly slowMs: number;

  constructor(
    @Inject(WINSTON_LOGGER) private readonly logger: Logger,
    configService: ConfigService<AllConfigType>,
  ) {
    const config = configService.getOrThrow(loggerConfigKey, { infer: true });
    this.enabled = config.LOG_HTTP_ENABLED;
    this.slowMs = config.LOG_SLOW_MS;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled || context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { userId?: string } }>();
    const res = http.getResponse<Response>();

    const { method, originalUrl } = req;
    const userAgent = req.headers['user-agent'] ?? '-';
    const ip = req.ip ?? req.socket?.remoteAddress ?? '-';
    const start = Date.now();

    const write = (errorStatus?: number) => {
      const duration = Date.now() - start;
      const statusCode = errorStatus ?? res.statusCode;
      const message = `${method} ${originalUrl} ${statusCode} ${duration}ms`;
      const meta = {
        context: CONTEXT,
        method,
        url: originalUrl,
        statusCode,
        durationMs: duration,
        ip,
        userAgent,
        userId: req.user?.userId ?? null,
      };

      if (duration >= this.slowMs) {
        this.logger.warn(`[慢请求] ${message}`, meta);
      } else {
        this.logger.info(message, meta);
      }
    };

    return next.handle().pipe(
      // 求成功完成时触发
      tap({
        // 请求成功完成时触发，调用 write() 写日志
        next: () => write(),
        // 请求抛错时触发，用异常里的 status 写日志，默认 500
        error: (err: { status?: number; statusCode?: number }) =>
          write(err?.status ?? err?.statusCode ?? 500),
      }),
    );
  }
}
