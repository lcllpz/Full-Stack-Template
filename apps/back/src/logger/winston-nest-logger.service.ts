import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { configure as configureStringify } from 'safe-stable-stringify';
import { Logger } from 'winston';

import { WINSTON_LOGGER } from './logger.constants';

/** 安全序列化：处理循环引用与 BigInt，避免日志本身成为故障点 */
const safeStringify = configureStringify({ circularValue: '[Circular]', bigint: true });

@Injectable()
export class WinstonNestLoggerService implements LoggerService {
  constructor(
    @Inject(WINSTON_LOGGER)
    private readonly logger: Logger,
  ) {}

  log(message: unknown, context?: string): void {
    this.logger.info(this.formatMessage(message), { context });
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error(this.formatMessage(message), { context, stack });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.formatMessage(message), { context });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.formatMessage(message), { context });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(this.formatMessage(message), { context });
  }

  fatal(message: unknown, stack?: string, context?: string): void {
    this.logger.error(this.formatMessage(message), { context, stack, fatal: true });
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    return safeStringify(message) ?? String(message);
  }
}
