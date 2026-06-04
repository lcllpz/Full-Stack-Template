import { queryOptions } from '@tanstack/react-query';

import { usersApi } from './api';
import type { UserListQuery } from './types';

/**
 * 集中管理 queryKey，避免硬编码字符串散落各处，
 * mutation 后用它做精准的 invalidate。
 */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (query?: UserListQuery) => [...userKeys.lists(), query ?? {}] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
};

/**
 * 用 queryOptions 复用查询配置：
 * 既能在 Client 端 useQuery 用，也能在 Server Component 里 prefetchQuery 用。
 */
export const userQueries = {
  list: (query?: UserListQuery) =>
    queryOptions({
      queryKey: userKeys.list(query),
      queryFn: () => usersApi.list(query),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: () => usersApi.detail(id),
    }),
};
