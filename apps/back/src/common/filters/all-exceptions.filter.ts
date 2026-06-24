import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsServiceManager } from 'nestjs-cls';
import { Logger } from 'winston';

import { LOG_CLS_TRACE_ID } from '@/config/logger/constants';
import { WINSTON_LOGGER } from '@/logger/logger.constants';

const CONTEXT = 'Exception';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  traceId?: string;
  timestamp: string;
  path: string;
}

/**
 * 统一错误响应 + 错误详情日志：
 * 全局异常过滤器：统一错误响应体 + 统一错误日志
 * - HttpException（预期异常，4xx）记为 warn
 * - 其余（非预期异常，5xx）记为 error 并带堆栈
 * - 日志与响应体均带 traceId，便于串联排查
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(WINSTON_LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.normalize(exception);
    const traceId = this.getTraceId();

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      traceId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    const logMeta = {
      context: CONTEXT,
      method: request.method,
      url: request.originalUrl,
      statusCode,
    };

    if (statusCode >= 500) {
      this.logger.error(this.toMessage(exception, statusCode, request), {
        ...logMeta,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.logger.warn(this.toMessage(exception, statusCode, request), logMeta);
    }

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error?: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { statusCode: status, message: res };
      }
      const obj = res as { message?: string | string[]; error?: string };
      return {
        statusCode: status,
        message: obj.message ?? exception.message,
        error: obj.error,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '服务器内部错误',
      error: 'Internal Server Error',
    };
  }

  private toMessage(exception: unknown, statusCode: number, request: Request): string {
    const detail = exception instanceof Error ? exception.message : String(exception);
    return `${request.method} ${request.originalUrl} ${statusCode} - ${detail}`;
  }

  private getTraceId(): string | undefined {
    try {
      const cls = ClsServiceManager.getClsService();
      if (cls?.isActive()) {
        return cls.get<string>(LOG_CLS_TRACE_ID);
      }
    } catch {
      // 忽略
    }
    return undefined;
  }
}
