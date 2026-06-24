export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export type LoggerConfigType = {
  LOG_LEVEL: LogLevel;
  LOG_FILE_ENABLED: boolean;
  LOG_DIR: string;
  LOG_MAX_SIZE: string;
  LOG_MAX_FILES: string;
  LOG_ZIPPED_ARCHIVE: boolean;
  LOG_HTTP_ENABLED: boolean;
  LOG_SLOW_MS: number;
};
