import { http, type RequestOptions } from '../request';

import type { CreateUserDto, UpdateUserDto, User, UserListQuery } from './types';

/**
 * 纯接口函数层：只负责「怎么请求后端」，不含任何 React / 缓存逻辑。
 * 好处：
 * - Server Component 可直接 await 调用（如 prefetch / SSR 取数）。
 * - Client 端由 TanStack Query 的 hooks 调用。
 *
 * 每个方法都接收可选的 options，便于 Server Component 透传 token：
 *   const token = (await cookies()).get('token')?.value;
 *   await usersApi.list(query, { token });
 * 客户端调用可省略，request 会自动从浏览器 cookie 读取 token。
 */
export const usersApi = {
  list: (query?: UserListQuery, options?: RequestOptions) =>
    http.get<User[]>('/users', { ...options, params: query }),

  detail: (id: number, options?: RequestOptions) => http.get<User>(`/users/${id}`, options),

  create: (dto: CreateUserDto, options?: RequestOptions) => http.post<User>('/users', dto, options),

  update: (id: number, dto: UpdateUserDto, options?: RequestOptions) =>
    http.patch<User>(`/users/${id}`, dto, options),

  remove: (id: number, options?: RequestOptions) => http.delete<void>(`/users/${id}`, options),
};
