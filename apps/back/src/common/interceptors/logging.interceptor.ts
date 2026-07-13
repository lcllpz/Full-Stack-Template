import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { map, Observable, tap } from 'rxjs';
import { Logger } from 'winston';

import { AllConfigType } from '@/config/config.type';
import { loggerConfigKey } from '@/config/logger/config';
import { WINSTON_LOGGER } from '@/logger/logger.constants';

const CONTEXT = 'HTTP';

/** 成功响应统一 envelope（文件流除外，错误响应由 AllExceptionsFilter 处理） */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * HTTP 响应拦截器：
 * - 成功响应统一包装为 ApiEnvelope，StreamableFile 保持原始流响应
 * - 记录访问日志（method/url/status/耗时/ip/userAgent/userId）
 * - 慢请求（超过 LOG_SLOW_MS）以 warn 记录
 * - 出错请求也会补一条访问日志（错误详情由 AllExceptionsFilter 负责）
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logEnabled: boolean;
  private readonly slowMs: number;

  constructor(
    @Inject(WINSTON_LOGGER) private readonly logger: Logger,
    configService: ConfigService<AllConfigType>,
  ) {
    const config = configService.getOrThrow(loggerConfigKey, { infer: true });
    this.logEnabled = config.LOG_HTTP_ENABLED;
    this.slowMs = config.LOG_SLOW_MS;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { userId?: string; id?: string } }>();
    const res = http.getResponse<Response>();

    const { method, originalUrl } = req;
    const userAgent = req.headers['user-agent'] ?? '-';
    const ip = req.ip ?? req.socket?.remoteAddress ?? '-';
    const start = Date.now();

    const writeLog = (errorStatus?: number) => {
      if (!this.logEnabled) {
        return;
      }

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
        userInfo: req.user ?? null,
        userInfoId: req.user?.userId || req.user?.id,
      };

      if (duration >= this.slowMs) {
        this.logger.warn(`[慢请求] ${message}`, meta);
      } else {
        this.logger.info(message, meta);
      }
    };

    return next.handle().pipe(
      // handle() 方法会返回一个Observable 对象。该数据流包含从路由处理程序返回 的值，因此我们可以轻松地使用 RxJS 的map() 操作符对其进行转换。
      map((data): ApiEnvelope<unknown> | StreamableFile => {
        if (data instanceof StreamableFile) {
          return data;
        }
        return {
          code: res.statusCode,
          message: 'ok',
          data,
        };
      }),
      // 使用了tap()操作符——该操作符会在可观察流（observable stream）正常终止或异常终止时调用我们定义的匿名日志记录函数，但不会对响应周期产生其他干扰。
      tap({
        next: () => writeLog(),
        error: (err: { status?: number; statusCode?: number }) => {
          writeLog(err?.status ?? err?.statusCode ?? 500);
        },
      }),
    );
  }
}
