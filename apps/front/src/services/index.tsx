/**
 * services 统一出口
 *
 * 目录结构：
 *   request.ts        —— fetch 薄封装（http.get/post/...，含错误处理与 Next.js 缓存选项）
 *   query-client.ts   —— getQueryClient（isServer 单例，官方推荐）
 *   query-provider.tsx—— QueryProvider（在 app/layout.tsx 包裹）
 *   users/            —— 业务领域示例
 *     ├─ types.ts     —— 类型定义
 *     ├─ api.ts       —— 纯接口函数（Server / Client 均可调用）
 *     ├─ queries.ts   —— queryKeys + queryOptions（Client 用 / Server 预取共用）
 *     └─ hooks.ts     —— useQuery / useMutation 业务 hooks（仅 Client）
 */

export * from './query-client';
export * from './query-provider';
export * from './request';
export * from './users/api';
export * from './users/hooks';
export * from './users/queries';
export * from './users/types';
