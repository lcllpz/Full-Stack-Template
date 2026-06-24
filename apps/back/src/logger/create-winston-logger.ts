import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { ClsServiceManager } from 'nestjs-cls';
import { configure as configureStringify } from 'safe-stable-stringify';
import { createLogger, format, Logger, LoggerOptions, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { Environment } from '@/config/app/config.type';
import { LoggerConfigType } from '@/config/logger/config.type';
import { LOG_APP_NAME, LOG_CLS_TRACE_ID } from '@/config/logger/constants';

import { isSensitiveKey, redact } from './redact';

/** 安全序列化：处理循环引用与 BigInt，避免 JSON.stringify 抛错 */
const safeStringify = configureStringify({ circularValue: '[Circular]', bigint: true });

/** 将任意值安全转为字符串，避免对象输出 [object Object] */
const text = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  return safeStringify(value) ?? '';
};

/** winston format 内部使用的字段，脱敏时需保留原值 */
const PRESERVED_KEYS = new Set(['level', 'message', 'timestamp', 'ms', 'stack', 'service']);

/** 从 CLS 读取当前请求的 traceId 注入日志 */
const traceIdFormat = format((info) => {
  try {
    const cls = ClsServiceManager.getClsService();
    if (cls?.isActive()) {
      const traceId = cls.get<string>(LOG_CLS_TRACE_ID);
      if (traceId) {
        info.traceId = traceId;
      }
    }
  } catch {
    // CLS 未激活（如应用启动阶段），忽略即可
  }
  return info;
});

/** 对日志的 meta/message 做敏感字段脱敏 */
const redactFormat = format((info) => {
  for (const key of Object.keys(info)) {
    if (PRESERVED_KEYS.has(key)) {
      continue;
    }
    if (isSensitiveKey(key)) {
      info[key] = '***';
    } else {
      info[key] = redact(info[key]);
    }
  }
  return info;
});

const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  traceIdFormat(),
  redactFormat(),
  format.json(),
);

const createConsoleFormat = (nodeEnv: Environment) => {
  const useColor = nodeEnv !== Environment.Production;

  return format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.ms(),
    format.errors({ stack: true }),
    format.splat(),
    traceIdFormat(),
    redactFormat(),
    ...(useColor ? [format.colorize({ all: true })] : []),
    format.printf(
      ({ timestamp, level, message, context, stack, ms, service, traceId, ...meta }) => {
        const appLabel = service ? `[${text(service)}] ` : '';
        const traceLabel = traceId ? `[${text(traceId)}] ` : '';
        const contextLabel = context ? `[${text(context)}] ` : '';
        const metaKeys = Object.keys(meta).filter((key) => key !== 'fatal');
        const metaStr = metaKeys.length ? ` ${safeStringify(meta)}` : '';
        const stackStr = stack ? `\n${text(stack)}` : '';
        const msStr = ms ? ` ${text(ms)}` : '';

        return `${text(timestamp)} ${appLabel}${text(level)}: ${traceLabel}${contextLabel}${text(message)}${metaStr}${msStr}${stackStr}`;
      },
    ),
  );
};

const createFileTransports = (loggerConfig: LoggerConfigType): DailyRotateFile[] => {
  mkdirSync(loggerConfig.LOG_DIR, { recursive: true });

  const baseOptions = {
    datePattern: 'YYYY-MM-DD',
    zippedArchive: loggerConfig.LOG_ZIPPED_ARCHIVE,
    maxSize: loggerConfig.LOG_MAX_SIZE,
    maxFiles: loggerConfig.LOG_MAX_FILES,
    format: jsonFormat,
  };

  return [
    new DailyRotateFile({
      ...baseOptions,
      filename: join(loggerConfig.LOG_DIR, 'error-%DATE%.log'),
      level: 'error',
    }),
    new DailyRotateFile({
      ...baseOptions,
      filename: join(loggerConfig.LOG_DIR, 'app-%DATE%.log'),
    }),
  ];
};

// 创建 winston 日志记录器
export const createWinstonLogger = (
  loggerConfig: LoggerConfigType,
  nodeEnv: Environment,
): Logger => {
  const loggerTransports: LoggerOptions['transports'] = [
    new transports.Console({
      stderrLevels: ['error'],
      format: createConsoleFormat(nodeEnv),
    }),
  ];

  let exceptionHandlers: LoggerOptions['exceptionHandlers'];
  let rejectionHandlers: LoggerOptions['rejectionHandlers'];

  if (loggerConfig.LOG_FILE_ENABLED) {
    loggerTransports.push(...createFileTransports(loggerConfig));

    exceptionHandlers = [
      new DailyRotateFile({
        filename: join(loggerConfig.LOG_DIR, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: loggerConfig.LOG_ZIPPED_ARCHIVE,
        maxSize: loggerConfig.LOG_MAX_SIZE,
        maxFiles: loggerConfig.LOG_MAX_FILES,
        format: jsonFormat,
      }),
    ];
    rejectionHandlers = [
      new DailyRotateFile({
        filename: join(loggerConfig.LOG_DIR, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: loggerConfig.LOG_ZIPPED_ARCHIVE,
        maxSize: loggerConfig.LOG_MAX_SIZE,
        maxFiles: loggerConfig.LOG_MAX_FILES,
        format: jsonFormat,
      }),
    ];
  }

  return createLogger({
    level: loggerConfig.LOG_LEVEL,
    defaultMeta: { service: LOG_APP_NAME },
    transports: loggerTransports,
    exceptionHandlers,
    rejectionHandlers,
    exitOnError: false,
  });
};
