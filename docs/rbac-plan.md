# RBAC 权限控制系统 —— 生产级实施计划

> 基于现有项目（NestJS + Next.js + TypeORM + JWT Session）扩展，实现基于角色的访问控制（RBAC）

---

## 一、整体架构设计

```
用户 (User)  ──── 多对多 ────  角色 (Role)  ──── 多对多 ────  菜单 (Menu)
                                                                    │
                                              type=DIRECTORY  目录节点（无权限码）
                                              type=MENU       页面节点（无权限码）
                                              type=BUTTON     按钮节点（code='user:create'）
                                                                    │
                                                         PermissionsGuard 校验 menu.code
```

### 设计核心：Menu 统一管理菜单与权限

传统 RBAC 会将 Permission 和 Menu 拆成两张表，导致 Role 需要同时维护「接口权限」和「菜单可见性」两套关联，容易不同步。

本系统采用 **Menu = 权限资源** 的统一设计：

| 菜单类型    | 作用            | code 字段                  |
| ----------- | --------------- | -------------------------- |
| `DIRECTORY` | 侧边栏目录容器  | `null`                     |
| `MENU`      | 路由页面节点    | `null`                     |
| `BUTTON`    | 页面内按钮/操作 | **必填**，如 `user:create` |

- **角色分配菜单**：通过 `role_menus` 中间表，一次操作同时控制「菜单可见」和「接口权限」
- **按钮节点的 `code`**：既是前端 `<PermissionWrapper code="user:create">` 的判断依据，也是后端 `@Permissions('user:create')` 守卫的校验目标

### 核心思路

| 层面           | 方案                                                      |
| -------------- | --------------------------------------------------------- |
| 后端接口保护   | `@Permissions()` 装饰器 + `PermissionsGuard`              |
| 前端菜单控制   | 登录后请求 `/auth/me` 获取动态菜单树（已按角色过滤）      |
| 前端按钮级控制 | `usePermission(code)` Hook + `<PermissionWrapper>` 组件   |
| 权限数据来源   | 服务端查 `user → roles → menus(type=BUTTON)` 取 code 集合 |
| 生产缓存       | Redis 缓存用户权限码集合，TTL 与 Session 保持一致         |

---

## 二、数据库模型设计

### 2.1 `menus` 表（统一管理菜单与权限）

```typescript
// apps/back/src/menu/entities/menu.entity.ts
export enum MenuType {
  DIRECTORY = 'directory', // 目录（无路由，只作为父节点）
  MENU = 'menu', // 菜单页面
  BUTTON = 'button', // 页面内按钮/操作
}

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  title: string;

  @Column({ type: 'enum', enum: MenuType, default: MenuType.MENU })
  type: MenuType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null; // 路由路径，BUTTON 类型为 null

  @Column({ type: 'varchar', length: 128, nullable: true })
  icon: string | null;

  /**
   * 权限码，仅 BUTTON 类型必填，格式：模块:操作，如 user:create
   * DIRECTORY / MENU 类型为 null（角色直接关联菜单节点控制可见性）
   * PermissionsGuard 通过此码校验接口访问权限
   */
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  code: string | null;

  /** 父菜单 id，顶层菜单为 null */
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ default: true })
  visible: boolean;

  /** 系统内置，不允许删除 */
  @Column({ default: false })
  isSystem: boolean;

  /** 拥有此菜单/按钮的角色 */
  @ManyToMany(() => Role, (role) => role.menus)
  roles: Role[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
```

### 2.2 `Role` 实体（关联 menus）

```typescript
// apps/back/src/role/entities/role.entity.ts
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ default: false })
  isSystem: boolean;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  /**
   * 角色拥有的菜单/按钮权限（主控方，创建 role_menus 中间表）
   * - DIRECTORY/MENU：控制菜单可见性
   * - BUTTON：同时作为接口级权限（PermissionsGuard 通过 menu.code 校验）
   */
  @ManyToMany(() => Menu, (menu) => menu.roles)
  @JoinTable({ name: 'role_menus' })
  menus: Menu[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
```

### 2.3 权限码常量（代码单一数据源）

独立的 `permissions` 数据库表已废弃。权限码统一定义在常量文件，种子脚本同步到 `menus` 表的 BUTTON 记录：

```typescript
// apps/back/src/permission/permission.constants.ts
export const PERMISSIONS = {
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
  MENU_READ: 'menu:read',
  MENU_CREATE: 'menu:create',
  MENU_UPDATE: 'menu:update',
  MENU_DELETE: 'menu:delete',
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOG: 'system:log',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
```

### 数据库表关系总览

```
users ──── user_roles（中间表）──── roles ──── role_menus（中间表）──── menus
```

| 表           | 说明                                                        |
| ------------ | ----------------------------------------------------------- |
| `users`      | 用户                                                        |
| `roles`      | 角色                                                        |
| `menus`      | 菜单树节点（目录/页面/按钮），BUTTON 类型的 `code` 即权限码 |
| `user_roles` | 用户-角色中间表（User 侧持有 `@JoinTable`）                 |
| `role_menus` | 角色-菜单中间表（Role 侧持有 `@JoinTable`）                 |

---

## 三、后端实现步骤

### 3.1 Permission 模块（权限码常量服务）

> ⚠️ Permission 不再是数据库实体，仅提供系统预定义权限码列表查询（供管理后台「分配菜单」时展示可用 code）

**文件结构：**

```
apps/back/src/permission/
  ├── entities/permission.entity.ts   ← 已废弃（占位文件）
  ├── permission.constants.ts         ← 权限码常量定义（单一数据源）
  ├── permission.controller.ts        ← GET /permission/list
  ├── permission.service.ts           ← 返回常量列表
  └── permission.module.ts
```

**接口：**

- `GET /permission/list` — 返回系统所有预定义权限码列表（管理后台创建 BUTTON 菜单时选用）

### 3.2 Menu 模块（CRUD + 树结构 + 权限分配入口）

**文件结构：**

```
apps/back/src/menu/
  ├── entities/menu.entity.ts
  ├── dto/
  │   ├── create-menu.dto.ts       ← BUTTON 类型时 code 必填
  │   └── query-menu.dto.ts
  ├── menu.controller.ts
  ├── menu.service.ts              ← 含 buildTree() 工具方法
  └── menu.module.ts
```

**核心接口：**

- `POST   /menu` — 创建菜单项（BUTTON 类型需填 code）
- `GET    /menu/tree` — 获取完整菜单树（管理端用）
- `PATCH  /menu/:id` — 修改菜单
- `DELETE /menu` — 删除菜单
- `PATCH  /menu/sort` — 拖拽排序（批量更新 sort 字段）

### 3.3 RoleService 扩展（菜单分配）

```typescript
// 为角色分配菜单（含目录、页面、按钮，一次性搞定）
assignMenus(roleId: string, menuIds: string[]): Promise<void>

// 查询角色拥有的菜单列表
getMenusByRoleId(roleId: string): Promise<Menu[]>

// 查询角色拥有的权限码集合（仅 BUTTON 类型的 code）
getPermissionCodesByRoleId(roleId: string): Promise<string[]>
```

**新增接口：**

- `POST /role/:id/menus` — 为角色分配菜单
- `GET  /role/:id/menus` — 查询角色拥有的菜单

### 3.4 实现权限守卫

#### 3.4.1 自定义 `@Permissions()` 装饰器

```typescript
// apps/back/src/common/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '@/permission/permission.constants';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...codes: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, codes);
```

#### 3.4.2 `PermissionsGuard`

```typescript
// apps/back/src/common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCodes = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredCodes?.length) return true; // 未标注则放行

    const { user } = context.switchToHttp().getRequest();

    // super_admin 豁免所有权限校验
    if (user.roles?.includes('super_admin')) return true;

    // 查询用户所有角色关联的 BUTTON 类型菜单 code 集合
    // user → roles → role_menus → menus(type=BUTTON) → code
    const userCodes = await this.userService.getPermissionCodes(user.userId);
    return requiredCodes.every((code) => userCodes.includes(code));
  }
}
```

#### 3.4.3 在 Controller 中使用

```typescript
import { PERMISSIONS } from '@/permission/permission.constants';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('user')
export class UserController {

  @Post()
  @Permissions(PERMISSIONS.USER_CREATE)  // ← 引用常量，避免魔法字符串
  create(@Body() dto: CreateUserDto) { ... }

  @Delete()
  @Permissions(PERMISSIONS.USER_DELETE)
  remove(@Body() dto: DeleteUserDto) { ... }
}
```

### 3.5 扩展 `/auth/me` 接口

登录后前端调用此接口获取：用户信息 + 权限码列表 + 可访问菜单树

```typescript
// GET /auth/me 返回结构
{
  user: { id, nickname, email, avatar, status },
  roles: ['admin', 'editor'],
  // 仅包含 BUTTON 类型的 code（前端按钮级权限判断用）
  permissions: ['user:read', 'user:create', 'role:read'],
  // 仅包含 DIRECTORY 和 MENU 类型（前端渲染侧边栏用）
  // BUTTON 节点不出现在菜单树中（通过 visible=false 或 type 过滤）
  menus: [
    {
      id: '...',
      title: '用户管理',
      path: '/users',
      icon: 'users',
      type: 'menu',
      children: []
    }
  ]
}
```

**UserService 新增方法：**

```typescript
// 获取用户的全部权限码
// 链路：User → user_roles → Role → role_menus → Menu(type=BUTTON) → code
async getPermissionCodes(userId: string): Promise<string[]>

// 获取用户可见的菜单树（仅 DIRECTORY + MENU 类型，按角色过滤）
async getAccessibleMenuTree(userId: string): Promise<Menu[]>
```

### 3.6 JWT Payload 扩展（可选优化）

在 token 中写入角色 codes，减少数据库查询：

```typescript
// auth.service.ts - getTokensData
const payload = {
  userId: data.userId,
  sessionId: data.sessionId,
  roles: data.roles, // ['admin'] ← 轻量角色标识
};
```

> ⚠️ 注意：roles 写入 token 后，角色变更需要重新登录才生效。
> 生产环境建议配合 Redis 缓存权限，并在角色变更时清除缓存，不写入 token。

> 我这里是直接通过user的id来查找的

---

## 四、前端实现步骤

### 4.1 Auth Store（Zustand）

```typescript
// apps/front/src/stores/auth.store.ts
interface AuthState {
  user: UserInfo | null;
  roles: string[];
  permissions: string[]; // BUTTON 类型菜单的 code 集合（按钮级权限）
  menus: MenuTreeNode[]; // DIRECTORY + MENU 类型的菜单树（侧边栏渲染用）
  token: string | null;
  refreshToken: string | null;

  setAuth: (data: LoginResponse) => void;
  hasPermission: (code: string) => boolean;
  hasRole: (role: string) => boolean;
  logout: () => void;
}
```

### 4.2 权限 Hook

```typescript
// apps/front/src/hooks/use-permission.ts
export function usePermission(code: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return permissions.includes(code);
}

export function useRole(role: string): boolean {
  const roles = useAuthStore((s) => s.roles);
  return roles.includes(role);
}
```

### 4.3 权限包装组件

```tsx
// apps/front/src/components/permission-wrapper.tsx
interface Props {
  code: string; // BUTTON 菜单的 code，如 'user:create'
  fallback?: ReactNode; // 无权限时显示什么，默认 null
  children: ReactNode;
}

export function PermissionWrapper({ code, fallback = null, children }: Props) {
  const hasPermission = usePermission(code);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// 使用示例
<PermissionWrapper code="user:delete">
  <Button danger>删除用户</Button>
</PermissionWrapper>;
```

### 4.4 动态侧边栏菜单

```
apps/front/src/components/layout/
  ├── sidebar.tsx          ← 根据 menus（DIRECTORY+MENU）动态渲染
  ├── sidebar-item.tsx     ← 单个菜单项（递归渲染子菜单）
  └── admin-layout.tsx     ← 包含 Sidebar + Header + Content
```

**渲染逻辑：**

- 登录成功 → 调用 `/auth/me` → 写入 store
- `Sidebar` 从 store 读取 `menus`（已过滤 BUTTON 节点）→ 递归渲染菜单树
- 菜单路径通过 `next/navigation` 的 `usePathname` 高亮当前项

### 4.5 路由保护（Next.js Middleware）

```typescript
// apps/front/src/middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;

  // 未登录跳转登录页
  if (!token && !isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 已登录访问登录页，跳首页
  if (token && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 4.6 Token 刷新拦截器（axios/fetch）

```typescript
// apps/front/src/services/request.ts 扩展
// 响应拦截：401 时自动调用 /auth/refresh，重试原请求
// 请求拦截：自动附加 Authorization: Bearer <token>
```

---

## 五、初始化种子数据

### 5.1 目录结构

```
apps/back/src/seeds/
├── database.module.ts      # NestJS 模块，应用启动时自动挂载并执行种子
├── index.ts                # 入口：按顺序调用 menu → role → admin
├── menu/
│   └── index.seed.ts       # 菜单树种子（从 permission.constants.ts 同步）
├── role/
│   └── index.seed.ts       # 角色种子（仅 super_admin，绑定全部菜单）
└── admin/
    └── index.seed.ts       # 系统账号种子（super_admin 用户）
```

**单一数据源原则**：菜单树数据来自 `permission.constants.ts` 中的 `menuList`，
权限码（`PERMISSIONS` 常量）与 `menus` 表 BUTTON 记录保持同步，
新增权限码只需在常量文件加一行，重跑种子即可自动补充数据库。

### 5.2 执行策略

| 环境                   | 触发条件                     | 说明                         |
| ---------------------- | ---------------------------- | ---------------------------- |
| `development` / `test` | 每次应用启动均执行           | 方便本地开发调试，幂等安全   |
| `production`           | 仅当 `RUN_SEEDS=true` 时执行 | 首次部署手动触发，防意外覆盖 |

**幂等策略**：每个 seed 函数在写入前先按唯一键查询（菜单按 `code`、角色按 `name`、用户按 `email`）。已存在则跳过或仅更新非核心字段，重复执行安全，不会产生重复数据。

**首次运行判断**：`runSeeds` 入口处检查 `super_admin` 角色是否已存在。若存在则直接返回，跳过全部 seed，避免每次启动都进行不必要的查询（生产环境优化）。

### 5.3 预置数据

#### 菜单树（共 3 个 MENU + 13 个 BUTTON = 16 条记录）

```
用户管理（MENU, path=/user, code=user:menu）
  ├── 用户列表（BUTTON, code=user:read）
  ├── 用户创建（BUTTON, code=user:create）
  ├── 用户编辑（BUTTON, code=user:update）
  └── 用户删除（BUTTON, code=user:delete）

角色管理（MENU, path=/role, code=role:menu）
  ├── 角色列表（BUTTON, code=role:read）
  ├── 角色创建（BUTTON, code=role:create）
  ├── 角色编辑（BUTTON, code=role:update）
  ├── 角色删除（BUTTON, code=role:delete）
  └── 角色分配（BUTTON, code=role:assign）

菜单管理（MENU, path=/menu, code=menu:menu）
  ├── 菜单列表（BUTTON, code=menu:read）
  ├── 菜单创建（BUTTON, code=menu:create）
  ├── 菜单编辑（BUTTON, code=menu:update）
  └── 菜单删除（BUTTON, code=menu:delete）
```

#### 预置角色

| 角色          | 类型     | 分配菜单              | 说明                                            |
| ------------- | -------- | --------------------- | ----------------------------------------------- |
| `super_admin` | 系统内置 | 全部菜单（含 BUTTON） | PermissionsGuard 对此角色直接豁免，绑定菜单备查 |

> 其他角色（`admin` / `editor` / `viewer`）按需在管理后台手动创建和分配，不在种子中预置，
> 降低初始化复杂度，也避免演示角色进入生产数据库。

#### 系统账号

| 字段       | 默认值        | 环境变量覆盖           |
| ---------- | ------------- | ---------------------- |
| `email`    | `super_admin` | `SUPER_ADMIN_EMAIL`    |
| `password` | `super_admin` | `SUPER_ADMIN_PASSWORD` |
| `nickname` | `超级管理员`  | —                      |
| `roles`    | `super_admin` | —                      |

> ⚠️ 生产环境首次部署后请立即通过环境变量替换默认密码！

### 5.4 DatabaseModule 注册

在 `AppModule` 中引入 `DatabaseModule`，应用启动后自动触发：

```typescript
// apps/back/src/app.module.ts
import { DatabaseModule } from './seeds/database.module';

@Module({
  imports: [
    // ... 其他模块
    DatabaseModule,
  ],
})
export class AppModule {}
```

### 5.5 手动执行（生产环境）

```bash
# 生产环境首次部署
RUN_SEEDS=true node dist/main.js

# 或使用环境变量替换默认账号
SUPER_ADMIN_EMAIL=admin@yourcompany.com \
SUPER_ADMIN_PASSWORD=YourStr0ngP@ss \
RUN_SEEDS=true node dist/main.js
```

---

## 六、生产环境强化

### 6.1 Redis 权限缓存

#### 为什么需要缓存？

不引入缓存时，每个需要鉴权的接口都会触发一次多表关联查询：

```
每次 API 请求（带鉴权）
  → PermissionsGuard
  → UserService.getPermissionCodes(userId)
  → SQL: users JOIN user_roles JOIN roles JOIN role_menus JOIN menus WHERE type='button'
  → 返回权限码集合 → 比对
```

权限数据属于**高频读、极低频写**：

- **读**：每个鉴权接口都读一次，100 并发 = 100 次重复查询
- **写**：只有管理员手动调整角色菜单时才变更

加入 Redis 后，同一用户的权限码只在首次请求时查库，后续命中缓存，延迟从 5~20ms 降至 <1ms。

#### 何时可以不用 Redis

| 阶段                            | 建议                                               |
| ------------------------------- | -------------------------------------------------- |
| 早期 / 单实例 / 低并发          | 直接查库，保持简单                                 |
| 多实例部署（K8s / PM2 cluster） | 必须用 Redis，内存缓存各节点不共享会导致权限不一致 |
| 生产高并发                      | 必须用 Redis                                       |

> **内存缓存不适用于多实例**：Node.js 进程内存缓存只在当前实例有效，实例 A 修改了角色，实例 B 的缓存不会失效，导致同一用户在不同实例上权限表现不一致。

#### 实现要点

```typescript
// 缓存 key 规范
// user_perms:{userId}

// 读取时优先命中缓存
const cached = await redis.get(`user_perms:${userId}`);
if (cached) return JSON.parse(cached);

// 缓存未命中 → 查库 → 写入缓存
const codes = await queryPermissionsFromDB(userId);
await redis.set(`user_perms:${userId}`, JSON.stringify(codes), 'EX', ttl);
return codes;

// 角色菜单变更后，主动删除该用户缓存
await redis.del(`user_perms:${userId}`);
// 若一次性修改了某角色下所有用户，批量清除：
// await redis.del(...affectedUserIds.map(id => `user_perms:${id}`))
```

**TTL 建议**：与 `JWT_EXPIRES_IN` 保持一致（token 过期后缓存自然失效）；也可设短一些（如 5 分钟），以缩短权限变更的生效延迟。

### 6.2 操作审计日志

#### 为什么需要审计日志？

RBAC 控制的是「能不能做」，审计日志记录的是「做了什么」。两者缺一不可：

- **安全溯源**：发生数据泄露或误删时，能精确还原「谁、何时、对哪条数据、做了什么」
- **合规要求**：等保 2.0、ISO 27001、金融/医疗行业监管均要求留存操作记录，且不可篡改
- **权限滥用发现**：即使有权限，异常时段的批量删除、导出等行为也可被审计系统告警
- **责任认定**：管理后台多人操作时，任何变更都可归责到具体操作人

#### 与 Winston 的区别（不重复）

| 维度           | Winston（应用日志）           | 审计日志（`audit_logs` 表）                |
| -------------- | ----------------------------- | ------------------------------------------ |
| **目的**       | 记录系统运行状态、报错、性能  | 记录**谁**在**何时**对**什么**做了**什么** |
| **受众**       | 开发者、运维、SRE             | 业务管理员、合规审计人员、安全团队         |
| **存储**       | 滚动日志文件 / ELK / 控制台   | 数据库（可 SQL 查询、分页、导出）          |
| **保留期**     | 7 ~ 30 天（按磁盘容量滚动）   | 长期保留（合规要求 1 ~ 3 年）              |
| **内容**       | `[ERROR] TypeError: ...`      | `admin 14:30 删除了用户张三 (id: xxx)`     |
| **业务关联**   | 无（纯技术信息）              | 有（关联 userId、resourceId）              |
| **可查询性**   | grep / kibana，无法做业务过滤 | 管理后台分页展示、按用户/资源/时间筛选     |
| **不可篡改性** | 日志文件可被修改              | 数据库可设只插入权限，搭配备份防篡改       |

**两者互补，不应替代：**

- Winston 负责：接口报错监控、性能日志、PermissionsGuard 拦截告警（写日志文件）
- 审计日志负责：管理后台「操作历史」功能、数据变更追溯、合规报告

#### 实现方案

新增 `audit_logs` 表，在 Service 层关键写操作后异步插入记录：

```typescript
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  userId: string; // 操作人 id
  action: string; // 权限码格式：user:delete
  resource: string; // 资源模块：user
  resourceId: string; // 被操作的资源 ID
  detail: object; // 操作前后的数据快照（JSON）
  ip: string; // 来源 IP
  userAgent: string; // 浏览器/客户端信息

  @CreateDateColumn()
  createdAt: Date;
}
```

> **建议**：审计日志只插入不更新不软删除，可在数据库层面对该表设置只读权限（应用账号仅有 INSERT + SELECT），防止被恶意修改。

### 6.3 超级管理员豁免

```typescript
// PermissionsGuard 中检查：若用户角色包含 super_admin 则直接放行
if (user.roles?.includes('super_admin')) return true;
```

### 6.4 接口限流（Rate Limiting）

#### 为什么需要限流？

RBAC 系统管理的是权限本身，一旦被攻破后果比普通业务系统更严重：

| 攻击场景         | 针对接口                          | 危害                                       |
| ---------------- | --------------------------------- | ------------------------------------------ |
| 暴力破解密码     | `POST /auth/login`                | 猜中管理员密码后可任意分配权限             |
| 批量注册垃圾账号 | `POST /auth/register`             | 污染用户数据，消耗系统资源                 |
| 爬取敏感数据     | `GET /user/page` `GET /role/list` | 用户信息、权限结构全量泄露                 |
| DoS 打垮服务     | 任意接口                          | CPU / 数据库连接池被打满，正常用户无法使用 |

限流是**成本极低、收益极高**的防护手段，几行配置即可挡住绝大多数脚本攻击。

#### 分级限流策略

```typescript
// 未登录用户（最严格，防暴力破解）
// POST /auth/login、POST /auth/register：10次/分钟

// 普通用户（常规限制）
// 所有接口：60次/分钟

// 管理员角色（宽松限制，支持批量操作）
// 所有接口：300次/分钟
```

#### 安装

```bash
pnpm add @nestjs/throttler
```

#### 超出限制时的响应

返回 `429 Too Many Requests`，前端根据此状态码展示「操作过于频繁，请稍后再试」提示。

### 6.5 全局异常过滤与错误码规范

| HTTP 状态码 | 场景                |
| ----------- | ------------------- |
| 401         | 未登录 / Token 失效 |
| 403         | 已登录但无权限      |
| 404         | 资源不存在          |
| 422         | 业务校验失败        |

---

## 七、实施顺序（分阶段）

### Phase 1 — 后端权限基础（预计 2 天）

- [x] `Menu` 实体设计（含 `code` 字段，与 Role 多对多）
- [x] `Role` 实体关联 `menus`（`@JoinTable({ name: 'role_menus' })`）
- [x] 权限码常量文件 `permission.constants.ts`
- [ ] `MenuService` CRUD + `buildTree()` 方法
- [ ] `RoleService` 扩展 `assignMenus()` / `getMenusByRoleId()`
- [ ] 实现 `@Permissions()` 装饰器 + `PermissionsGuard`
- [ ] `UserService.getPermissionCodes()` 方法（查 BUTTON 类型菜单的 code）
- [ ] 现有 `UserController` / `RoleController` 标注权限码

### Phase 2 — 菜单接口与 auth/me 扩展（预计 1 天）

- [ ] `GET /menu/tree` — 完整菜单树（管理端）
- [ ] `POST /role/:id/menus` — 为角色分配菜单
- [ ] 扩展 `GET /auth/me` 返回 `permissions`（BUTTON code 集合）+ `menus`（DIRECTORY+MENU 树）

### Phase 3 — 前端权限控制（预计 2 天）

- [ ] Zustand Auth Store（含 `permissions` / `menus`）
- [ ] `usePermission` / `useRole` Hook
- [ ] `<PermissionWrapper>` 组件
- [ ] 动态 Sidebar 组件（递归渲染菜单树）
- [ ] Next.js Middleware 路由守卫
- [ ] 请求拦截器（自动刷新 Token）

### Phase 4 — 初始化种子数据（预计 0.5 天）

- [ ] 菜单树种子数据（含所有 BUTTON 节点的 code）
- [ ] 角色种子数据（含菜单分配）
- [ ] 超级管理员账号

### Phase 5 — 生产强化（预计 1 天）

- [ ] Redis 权限缓存
- [ ] 审计日志
- [ ] 接口限流
- [ ] 统一错误码

---

## 八、接口总览

| 方法   | 路径               | 描述                       | 所需权限      |
| ------ | ------------------ | -------------------------- | ------------- |
| GET    | `/auth/me`         | 当前用户信息+权限码+菜单树 | 已登录        |
| GET    | `/permission/list` | 系统预定义权限码列表       | 已登录        |
| GET    | `/menu/tree`       | 完整菜单树（含 BUTTON）    | `menu:read`   |
| POST   | `/menu`            | 创建菜单项                 | `menu:create` |
| PATCH  | `/menu/:id`        | 修改菜单                   | `menu:update` |
| DELETE | `/menu`            | 删除菜单                   | `menu:delete` |
| PATCH  | `/menu/sort`       | 菜单排序                   | `menu:update` |
| POST   | `/role/:id/menus`  | 为角色分配菜单             | `role:assign` |
| GET    | `/role/:id/menus`  | 查询角色拥有的菜单         | `role:read`   |

---

## 九、技术选型参考

| 依赖                                | 用途                         |
| ----------------------------------- | ---------------------------- |
| `ioredis` + `@nestjs/cache-manager` | 权限缓存                     |
| `nestjs-cls`                        | 请求上下文传递（审计日志用） |
| `@nestjs/throttler`                 | 接口限流                     |
| `zustand`                           | 前端状态管理（已有）         |
| `next/navigation`                   | 路由跳转 + 路径匹配          |

---

## 问题思考

### Q1：Winston 日志和审计日志功能是否重复？

不重复，两者互补：

- **Winston**：记录「系统发生了什么」（技术视角），受众是开发者/运维，存日志文件，滚动保留 7~30 天
- **审计日志**：记录「谁做了什么」（业务视角），受众是管理员/合规审计，存数据库，长期保留 1~3 年

Winston 无法支撑管理后台的「操作历史」功能，审计日志无法替代报错监控。两者都要。

---

### Q2：为什么要 Redis 权限缓存？

权限数据是**高频读、极低频写**：每个鉴权接口都触发一次 `User → Roles → Menus(BUTTON)` 的多表 JOIN，Redis 将延迟从 5~20ms 降至 <1ms。

- **单实例 / 低并发早期项目**：直接查库即可，不必引入 Redis
- **多实例部署**：必须用 Redis，进程内存缓存各节点不共享，会导致权限不一致
- 角色菜单变更后主动删除对应用户的缓存 key，下次请求自动重建

---

### Q3：为什么要接口限流？

RBAC 系统管理权限本身，一旦管理员账号被攻破，攻击者可给自己分配任意权限，危害远大于普通业务系统。限流重点防护：

| 接口                  | 风险               |
| --------------------- | ------------------ |
| `POST /auth/login`    | 暴力破解管理员密码 |
| `POST /auth/register` | 批量注册垃圾账号   |
| `GET /user/page`      | 爬取用户数据       |

成本极低（几行配置），收益极高，生产环境必加。超出限制返回 `429 Too Many Requests`。

---

### Q4：为什么不单独建 permissions 表？

**原因：Menu 已经包含了权限信息。**

- `BUTTON` 类型的菜单节点的 `code` 字段就是权限码
- 角色通过 `role_menus` 直接关联菜单（含按钮），一次分配同时控制「菜单可见」和「接口权限」
- 无需两张表分别维护，避免数据不同步问题

**权限码的单一数据源：`permission.constants.ts`**

```typescript
// 代码中引用常量，不写魔法字符串
@Permissions(PERMISSIONS.USER_CREATE)

// 种子脚本启动时将常量同步为 menus 表中的 BUTTON 记录
// 新增权限码 → 常量文件加一行 → 重跑种子 → 数据库自动补充
```

**什么时候才需要单独的 permissions 表？**

当系统存在大量「纯接口级权限」（有权限码但不对应任何菜单节点）时，可以考虑单独建表。对于管理后台类系统，所有权限都有对应的 UI 操作入口，Menu 统一方案足够。

---

### Q5：「内存缓存不适用于多实例」怎么理解？

**问题**：6.1 节提到「Node.js 进程内存缓存只在当前实例有效，实例 A 修改了角色，实例 B 的缓存不会失效，导致同一用户在不同实例上权限表现不一致」——这句话具体指什么？

**理解要点**：

- 每个 Node.js 进程有**独立内存**。用 `Map`、变量或内存型 cache store 缓存权限时，数据只存在于**当前进程**，其他实例看不到，也收不到失效通知。
- **典型场景**（PM2 cluster / K8s 多 Pod）：
  1. 用户请求打到实例 A，查库得到 `[read]`，写入 A 的内存缓存。
  2. 用户请求打到实例 B，查库得到 `[read, write]`，写入 B 的内存缓存。
  3. 管理员修改该用户角色，实例 A 更新数据库并清掉 A 的缓存。
  4. **实例 B 内存里仍是旧权限**，它不知道 A 已变更。
- **结果**：同一用户、同一 token，请求落到不同实例时，有的接口能访问、有的 403——权限表现不一致。

**与 Redis 的区别**：Redis 是所有实例**共享**的外部存储。角色/菜单变更后 `DEL user_perms:{userId}`，任意实例下次鉴权都会 miss 缓存、重新查库，行为一致。

**何时可不用 Redis**：单实例或低并发早期项目，没有「另一个实例持有旧缓存」的问题，直接查库或进程内缓存均可。
