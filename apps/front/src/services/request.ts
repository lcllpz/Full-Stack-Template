/**
 * fetch 薄封装
 *
 * 设计原则：
 * 1. 不引入 axios，保留 Next.js 对原生 fetch 的增强能力（next.revalidate / next.tags / cache）。
 * 2. 统一 baseURL、JSON 解析、错误抛出，让上层（接口函数 / TanStack Query）只关心业务。
 * 3. Server Component 与 Client Component 均可调用。
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/** Next.js 对 fetch 的扩展选项（缓存 / 再验证），仅在服务端取数时生效 */
type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};

export type RequestOptions = Omit<RequestInit, 'body'> & {
  /** 请求体，会自动 JSON 序列化（FormData / string 等原样传递） */
  body?: unknown;
  /** 查询参数，自动拼接到 URL */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Next.js 缓存控制：next: { revalidate, tags } */
  next?: NextFetchOptions;
  /**
   * 显式传入 token，会写入 Authorization: Bearer。
   * 主要给 Server Component / SSR 预取使用：
   *   const token = (await cookies()).get('token')?.value;
   *   usersApi.list(query, { token });
   * 客户端可不传，会自动从浏览器 cookie 读取。
   */
  token?: string;
};

/** Cookie 中存放 token 的字段名（与后端 / 登录写入保持一致） */
const TOKEN_COOKIE_KEY = 'token';

/**
 * 仅浏览器环境：从 document.cookie 读取 token。
 * 注意：httpOnly cookie 无法被 JS 读取（此时返回 undefined，但同源请求浏览器会自动携带）。
 */
function getClientToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${TOKEN_COOKIE_KEY}=`));
  return match ? decodeURIComponent(match.slice(TOKEN_COOKIE_KEY.length + 1)) : undefined;
}

/** 统一的请求错误，便于上层按 status 做分支处理（如 401 跳登录） */
export class RequestError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.append(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function isPlainBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  );
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers, next, token, ...rest } = options;

  const isJson = isPlainBody(body);
  const finalHeaders = new Headers(headers);
  if (isJson && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  // 「拦截器」思路：优先用显式传入的 token（服务端），否则尝试从浏览器 cookie 读取。
  // 已手动设置 Authorization 时不覆盖。
  const authToken = token ?? getClientToken();
  if (authToken && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  const res = await fetch(buildUrl(path, params), {
    ...rest,
    headers: finalHeaders,
    // 同源 httpOnly cookie 自动携带；跨域需后端配置 CORS（Access-Control-Allow-Credentials）
    credentials: rest.credentials ?? 'include',
    body: isJson ? JSON.stringify(body) : (body as BodyInit | undefined),
    // Next.js 扩展：仅服务端取数时生效，客户端无副作用
    ...(next ? { next } : {}),
  });

  // 204 / 空响应直接返回 undefined
  const text = await res.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const message =
      (data as { message?: string })?.message ?? `请求失败：${res.status} ${res.statusText}`;
    throw new RequestError(res.status, message, data);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** 语义化便捷方法 */
export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
