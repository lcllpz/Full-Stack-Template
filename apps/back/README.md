# @full-stack-template-monorepo/back

基于 [NestJS](https://nestjs.com/) 的后端服务，为 Full-Stack-Template monorepo 提供 **RBAC 管理后台 REST API**。包含 JWT 认证、角色/菜单/用户管理、操作审计、限流、Winston 日志与可选 Redis 缓存。

## 技术栈

| 类别       | 技术                                     |
| ---------- | ---------------------------------------- |
| 框架       | NestJS 11                                |
| 语言       | TypeScript 5                             |
| ORM        | TypeORM + MySQL                          |
| 认证       | Passport + JWT（Access / Refresh Token） |
| 校验       | class-validator + class-transformer      |
| 文档       | Swagger（开发环境默认开启）              |
| 缓存       | Redis（可选，权限/菜单缓存）             |
| 限流       | @nestjs/throttler（内存或 Redis 存储）   |
| 日志       | Winston + 按日切割文件                   |
| 请求上下文 | nestjs-cls（traceId、IP、User-Agent）    |

## 功能概览

- **认证**：邮箱注册（图形验证码 + 邮箱验证码两步）、密码登录、邮箱/手机验证码登录、刷新 Token、退出、获取当前用户（含权限码与可见菜单树）
- **账号安全**：三渠道重置密码（旧密码 / 邮箱码 / 手机码）、绑定手机、换绑邮箱 / 手机（双重验证）
- **RBAC**：用户 / 角色 / 菜单三级权限，按钮级权限码（`模块:操作`）
- **菜单**：树形结构（目录 / 页面 / 按钮），支持一键生成标准模块菜单
- **审计**：操作日志分页查询
- **种子数据**：启动时自动初始化菜单、角色、超级管理员（幂等）
- **全局能力**：统一异常响应、HTTP 访问日志、链路追踪 ID、接口限流

## 目录结构

```
apps/back/
├── src/
│   ├── auth/              # 认证（密码/验证码登录、注册、改密、绑定换绑、JWT/Refresh/Session）
│   ├── user/              # 用户 CRUD
│   ├── role/              # 角色 CRUD + 菜单绑定
│   ├── menu/              # 菜单树管理
│   ├── permission/        # 权限装饰器、Guard、权限码常量
│   ├── audit/             # 操作审计
│   ├── session/           # 登录会话
│   ├── captcha/           # 图形验证码（SVG）
│   ├── verification/      # 验证码生成/存储/校验/风控（Redis）
│   ├── queue/             # BullMQ 队列与 processor（异步发信/发短信）
│   ├── mail/              # 邮件发送（SMTP / dev 打印验证码）
│   ├── sms/               # 短信发送（可插拔 provider，dev 用 mock）
│   ├── file/              # 文件上传（头像等）
│   ├── health/            # 健康检查
│   ├── redis/             # Redis 连接与权限缓存
│   ├── throttle/          # 全局限流
│   ├── logger/            # Winston 日志
│   ├── seeds/             # 数据库种子脚本
│   ├── config/            # 分模块环境配置（app/auth/dataBase/fileStorage/logger/mail/redis/seeds/sms/verification）
│   ├── common/            # 全局 Filter、Interceptor
│   ├── swagger/           # Swagger 初始化
│   ├── utils/             # 校验、类型工具
│   ├── app.module.ts      # 根模块
│   └── main.ts            # 应用入口（bootstrap）
├── scripts/               # 辅助脚本
│   └── auth-smoke.mjs     # 认证端到端冒烟测试
├── test/                  # E2E 测试
│   ├── app.e2e-spec.ts
│   ├── file-upload.e2e-spec.ts
│   └── jest-e2e.json      # E2E Jest 配置
├── dist/                  # 编译输出（构建时生成）
├── uploads/               # 本地上传文件目录（运行时生成）
├── logs/                  # 日志文件目录（运行时生成）
├── node_modules/          # 依赖（安装时生成）
├── .turbo/                # Turborepo 缓存（构建时生成）
├── .env                   # 本地环境变量（不提交）
├── .env.example           # 环境变量模板
├── nest-cli.json          # Nest CLI 配置
├── package.json           # 包与脚本定义
├── tsconfig.json          # TypeScript 配置（含 @/* 路径别名）
├── tsconfig.build.json    # 构建用 TS 配置
└── README.md              # 本文档
```

路径别名：`@/*` → `src/*`（见 `tsconfig.json`）。

## 快速开始

### 前置条件

- Node.js ≥ 18
- pnpm（monorepo 使用 `pnpm@10.13.1`）
- MySQL 8.x（本地或远程实例）
- Redis（可选，`REDIS_ENABLED=true` 时启用）

### 1. 安装依赖

在 monorepo 根目录执行：

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp apps/back/.env.example apps/back/.env
```

按需修改 `.env`，至少需要正确配置 MySQL 连接信息。完整变量说明见 [环境变量](#环境变量)。

### 3. 创建数据库

在 MySQL 中创建与 `DATABASE_NAME` 同名的库（默认 `fullstacktemplate`）：

```sql
CREATE DATABASE fullstacktemplate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

开发环境下 TypeORM 会自动 `synchronize` 建表；生产环境请关闭 `synchronize` 并使用迁移方案。

### 4. 启动开发服务

**方式 A — 在 monorepo 根目录（推荐）：**

```bash
pnpm api:dev
```

**方式 B — 仅启动后端：**

```bash
pnpm --filter @full-stack-template-monorepo/back dev
```

**方式 C — 进入本目录：**

```bash
cd apps/back
pnpm dev
```

默认监听 `http://localhost:4000`（以 `.env` 中 `PORT` 为准）。

### 5. 访问 Swagger

开发环境默认开启，地址：

```
http://localhost:4000/api/docs
```

可在 Swagger 右上角 **Authorize** 填入登录返回的 Access Token 调试受保护接口。

## 环境变量

复制 `.env.example` 后按需调整。主要分组如下：

| 分组    | 变量                                            | 说明                                  |
| ------- | ----------------------------------------------- | ------------------------------------- |
| 应用    | `PORT`                                          | 服务端口，默认 `4000`                 |
| 应用    | `NODE_ENV`                                      | `development` / `production` / `test` |
| 数据库  | `DATABASE_*`                                    | MySQL 连接信息                        |
| 认证    | `JWT_SECRET` / `JWT_EXPIRES_IN`                 | Access Token                          |
| 认证    | `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh Token                         |
| Redis   | `REDIS_ENABLED`                                 | 是否启用 Redis（默认 `false`）        |
| Redis   | `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB`        | Redis 连接                            |
| Swagger | `SWAGGER_ENABLED` / `SWAGGER_PATH`              | 开发默认开启，生产默认关闭            |
| 日志    | `LOG_LEVEL` / `LOG_FILE_ENABLED` / `LOG_DIR` 等 | 见 `.env.example` 注释                |
| 种子    | `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`    | 超级管理员账号                        |
| 种子    | `RUN_SEEDS` / `FORCE_SEEDS`                     | 种子执行策略                          |

> **生产环境注意**：`JWT_SECRET` 与 `JWT_REFRESH_SECRET` 为必填项；首次部署后请立即修改超级管理员默认密码。

## 种子数据

应用启动后由 `DatabaseModule` 自动执行种子（幂等）：

1. 菜单树（来自 `permission.constants.ts` 中的 `menuList`）
2. 角色（含菜单绑定，`super_admin` 拥有全部权限）
3. 超级管理员账号

| 环境               | 执行策略                     |
| ------------------ | ---------------------------- |
| development / test | 每次启动都尝试执行           |
| production         | 仅当 `RUN_SEEDS=true` 时执行 |

若 `super_admin` 角色已存在，则跳过全部种子。需要强制重跑（如新增菜单节点）时设置 `FORCE_SEEDS=true`。

默认超级管理员（可通过环境变量覆盖）：

| 字段 | 默认值                |
| ---- | --------------------- |
| 邮箱 | `Super_admin1@qq.com` |
| 密码 | `Super_admin1@qq.com` |
| 角色 | `super_admin`         |

## API 概览

| 模块 | 前缀     | 说明                               |
| ---- | -------- | ---------------------------------- |
| 认证 | `/auth`  | 注册、登录、刷新、退出、`/auth/me` |
| 用户 | `/user`  | CRUD + 列表/分页查询               |
| 角色 | `/role`  | CRUD + 菜单绑定                    |
| 菜单 | `/menu`  | 树/列表/单条、一键生成模块、排序   |
| 审计 | `/audit` | 操作日志分页                       |

除 `/auth/register`、`/auth/login` 外，业务接口均需 Bearer Token，并通过 `@Permissions()` 校验按钮级权限码。`super_admin` 角色豁免所有权限校验。

### 认证流程简述

> 邮箱密码注册 / 登录 / 刷新 / 退出的逐步说明、守卫链路与源码索引见：[docs/back/登录注册功能/邮箱密码登录.md](../../docs/back/登录注册功能/邮箱密码登录.md)

```
登录 → 创建 Session → 返回 accessToken + refreshToken
       ↓
请求受保护接口 → JwtStrategy 校验 → PermissionsGuard 校验权限码
       ↓
Token 过期 → POST /auth/refresh（携带 refreshToken）→ 轮换 Session hash → 返回新 Token 对
       ↓
退出 → POST /auth/logout → 软删除 Session
```

## 权限模型

权限码定义在 `src/permission/permission.constants.ts`，规则为 `模块:操作`（全小写）：

```
user:read / user:create / user:update / user:delete
role:read / role:create / role:update / role:delete / role:assign
menu:read / menu:create / menu:update / menu:delete
system:log
```

- 每个权限码对应 `menus` 表中一条 `type=BUTTON` 的记录
- 角色通过关联菜单获得权限；用户通过关联角色获得权限
- `/auth/me` 返回当前用户的权限码集合与可见菜单树（供前端路由与按钮显隐）

## 日志与追踪

- 使用 **Winston** 作为 Nest 全局 Logger
- 每个 HTTP 请求自动生成或透传 `x-request-id` 作为 **traceId**
- `LoggingInterceptor` 记录 HTTP 访问日志；慢请求（默认 > 1000ms）以 warn 级别记录
- `AllExceptionsFilter` 统一错误响应体，响应与日志均携带 `traceId`
- 开发环境默认仅控制台输出；生产环境默认写入 `logs/` 目录并按日切割
- **远程采集（可选）**：本机 Loki 栈见仓库 [`deploy/observability/README.md`](../../deploy/observability/README.md)（文件 → Promtail → Loki → Grafana）

## Redis

`REDIS_ENABLED=false`（默认）时不连接 Redis，限流使用内存存储，权限数据直接查库。

启用 Redis 后：

- 权限/菜单缓存（多实例部署时建议开启）
- 限流计数可切换为 Redis 存储（见 `throttle/throttle-storage.factory.ts`）
- 可通过 `REDIS_PERMISSION_CACHE_TTL_SECONDS` 调整缓存 TTL

## 限流

基于 `@nestjs/throttler`，默认策略（60 秒窗口）：

| 场景                               | 限制        |
| ---------------------------------- | ----------- |
| 未登录敏感接口（login / register） | 10 次/分钟  |
| 已登录普通用户                     | 60 次/分钟  |
| 超级管理员                         | 300 次/分钟 |

## 常用脚本

在 `apps/back` 目录下，或通过 `pnpm --filter @full-stack-template-monorepo/back <script>` 执行：

| 命令              | 说明               |
| ----------------- | ------------------ |
| `pnpm dev`        | 开发模式（热重载） |
| `pnpm build`      | 编译到 `dist/`     |
| `pnpm start:prod` | 运行编译产物       |
| `pnpm lint`       | ESLint 检查        |
| `pnpm test`       | 单元测试           |
| `pnpm test:e2e`   | E2E 测试           |
| `pnpm test:cov`   | 测试覆盖率         |

Lint / Format 由 monorepo 根目录统一配置（ESLint 9 + Prettier + Husky）。

## 生产部署

```bash
# 构建
pnpm --filter @full-stack-template-monorepo/back build

# 启动（需提前配置生产环境变量）
NODE_ENV=production node apps/back/dist/main
```

生产环境 checklist：

- [ ] 设置强随机 `JWT_SECRET` / `JWT_REFRESH_SECRET`
- [ ] 关闭 TypeORM `synchronize`（代码中 production 已自动关闭）
- [ ] 按需设置 `RUN_SEEDS=true` 完成首次初始化，之后关闭
- [ ] 修改超级管理员默认密码
- [ ] 按需启用 Redis 与文件日志

## 相关文档
