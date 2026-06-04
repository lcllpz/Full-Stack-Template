'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi } from './api';
import { userKeys, userQueries } from './queries';
import type { CreateUserDto, UpdateUserDto, UserListQuery } from './types';

/** 查询用户列表 */
export function useUsers(query?: UserListQuery) {
  return useQuery(userQueries.list(query));
}

/** 查询单个用户详情 */
export function useUser(id: number) {
  return useQuery({
    ...userQueries.detail(id),
    enabled: Number.isFinite(id),
  });
}

/** 创建用户，成功后失效列表缓存触发自动刷新 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/** 更新用户，成功后同时失效列表与对应详情缓存 */
export function useUpdateUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateUserDto) => usersApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

/** 删除用户，成功后失效列表缓存 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
