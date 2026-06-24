/** 需要脱敏的字段名（小写匹配，包含即命中） */
const SENSITIVE_KEYS = [
  'password',
  'pwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'creditcard',
  'bankcard',
  'idcard',
  'phone',
  'mobile',
];

const MASK = '***';
/** 防止超深/超大对象导致遍历开销过大 */
const MAX_DEPTH = 6;

export const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive));
};

/**
 * 深度遍历对象/数组，对命中敏感字段名的值做掩码。
 * - 使用 WeakSet 处理循环引用
 * - 限制最大深度，避免性能问题
 * - 不修改入参，返回新对象
 */
export const redact = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return '[Truncated]';
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? MASK : redact(val, depth + 1, seen);
  }
  return result;
};
