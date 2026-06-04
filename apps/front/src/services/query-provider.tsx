'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { getQueryClient } from './query-client';

/**
 * 全局 Provider，需在 app/layout.tsx 中包裹 children。
 * 注意：不要用 useState 初始化 queryClient（无 suspense 边界时 React 会丢弃它）。
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
