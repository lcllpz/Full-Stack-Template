import { http } from '../request';

import type { CreateUserDto, UpdateUserDto, User, UserListQuery } from './types';

/**
 * 纯接口函数层：只负责「怎么请求后端」，不含任何 React / 缓存逻辑。
 * 好处：
 * - Server Component 可直接 await 调用（如 prefetch / SSR 取数）。
 * - Client 端由 TanStack Query 的 hooks 调用。
 */
export const usersApi = {
  list: (query?: UserListQuery) => http.get<User[]>('/users', { params: query }),

  detail: (id: number) => http.get<User>(`/users/${id}`),

  create: (dto: CreateUserDto) => http.post<User>('/users', dto),

  update: (id: number, dto: UpdateUserDto) => http.patch<User>(`/users/${id}`, dto),

  remove: (id: number) => http.delete<void>(`/users/${id}`),
};
