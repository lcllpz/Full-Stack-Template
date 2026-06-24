export const ENV_LOG_LEVEL = 'LOG_LEVEL';
export const ENV_LOG_FILE_ENABLED = 'LOG_FILE_ENABLED';
export const ENV_LOG_DIR = 'LOG_DIR';
export const ENV_LOG_MAX_SIZE = 'LOG_MAX_SIZE';
export const ENV_LOG_MAX_FILES = 'LOG_MAX_FILES';
export const ENV_LOG_ZIPPED_ARCHIVE = 'LOG_ZIPPED_ARCHIVE';
export const ENV_LOG_HTTP_ENABLED = 'LOG_HTTP_ENABLED';
export const ENV_LOG_SLOW_MS = 'LOG_SLOW_MS';

export const LOG_DEFAULT_DIR = 'logs';
export const LOG_APP_NAME = 'Back';

/** 单个日志文件最大大小，超过后切割（支持 k/m/g 后缀） */
export const LOG_DEFAULT_MAX_SIZE = '20m';
/** 日志保留时长/数量，支持 14d（天）或纯数字（个数） */
export const LOG_DEFAULT_MAX_FILES = '14d';
/** 慢请求阈值（毫秒），超过则以 warn 级别记录 */
export const LOG_DEFAULT_SLOW_MS = 1000;

/** nestjs-cls 中存放链路追踪 ID 的键 */
export const LOG_CLS_TRACE_ID = 'log.traceId';
/** 链路追踪请求/响应头名称 */
export const TRACE_ID_HEADER = 'x-request-id';
