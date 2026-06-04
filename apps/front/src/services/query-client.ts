import { isServer, QueryClient } from '@tanstack/react-query';

/**
 * 创建 QueryClient。
 * SSR 场景下设置 staleTime > 0，避免数据到达客户端后立即重新请求。
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * 获取 QueryClient（TanStack Query 官方 App Router 推荐写法）：
 * - 服务端：每次请求都新建，避免不同用户间数据串味。
 * - 浏览器：复用单例，避免 React 在初次渲染 suspend 时重建 client。
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
