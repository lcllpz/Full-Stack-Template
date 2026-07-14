# NestJS Events（事件）

基于官方 [Events](https://docs.nestjs.com/techniques/events) 整理。读完应能回答：

- `@nestjs/event-emitter` 解决什么问题？和直接调用 Service 方法比优势在哪？
- `emit` / `@OnEvent` 怎么用？通配符、`async`、`suppressErrors` 分别什么时候用？
- 和 Queues、Task scheduling 怎么分工？本仓库什么时候该上事件？

> 官方示例：[nestjs/nest sample/30-event-emitter](https://github.com/nestjs/nest/tree/master/sample/30-event-emitter)  
> 底层库：[EventEmitter2](https://github.com/EventEmitter2/EventEmitter2)  
> 本仓库现状：尚未接入 `@nestjs/event-emitter`（见 [未来学习计划](./未来学习计划.md) P1）

---

## 1. 它解决什么问题

一个动作发生后，让**多个互不依赖的模块**都能收到通知、各自处理，而不用互相注入：

| 场景                 | 典型例子                                                 |
| -------------------- | -------------------------------------------------------- |
| 一件事触发多个副作用 | 下单成功 → 扣库存、发通知、记审计，三者互不知道对方存在  |
| 打破模块耦合         | `UserService` 删用户，不必反向 `import` `SessionService` |
| 进程内广播           | 配置变更、缓存失效通知同进程内多个监听者                 |

`EventEmitterModule` 内部基于 [eventemitter2](https://github.com/EventEmitter2/EventEmitter2)，是**同步进程内**的观察者模式实现：不落盘、不跨进程、默认不重试——这是它和 Queues 最本质的区别。

**和周边能力的边界：**

| 能力                | 职责                                               |
| ------------------- | -------------------------------------------------- |
| **Events**          | 进程内解耦广播：一个事件、多个监听者，各自独立处理 |
| **Queues**          | 异步执行、持久化、重试、削峰、跨进程/跨机器消费    |
| **Task scheduling** | 到点触发（定时器）                                 |

常见组合：业务动作 `emit` 事件 → 监听者里如果是慢活/需要可靠重试，再 `queue.add()` 丢进队列；Cron 到点也可以 `emit` 一个事件让多个监听者各自响应。

---

## 2. 安装与启用

```bash
npm install --save @nestjs/event-emitter
```

在根模块启用（`forRoot()` 会在 `onApplicationBootstrap` 时注册所有声明式监听器）：

```typescript
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
})
export class AppModule {}
```

**可选配置**（传给 `forRoot()`，转发给底层 `EventEmitter2`）：

| 字段                | 作用                                              |
| ------------------- | ------------------------------------------------- |
| `wildcard`          | 是否启用通配符订阅（`order.*`），默认 `false`     |
| `delimiter`         | 命名空间分隔符，默认 `.`                          |
| `maxListeners`      | 单个事件最多监听者数（超过打内存泄漏警告）        |
| `verboseMemoryLeak` | 内存泄漏警告里是否带具体事件名                    |
| `ignoreErrors`      | 监听者抛错且事件名为 `error` 时是否忽略未捕获异常 |

```typescript
EventEmitterModule.forRoot({
  wildcard: true,
  delimiter: '.',
  maxListeners: 20,
  verboseMemoryLeak: true,
});
```

---

## 3. 触发事件（Dispatching）

注入 `EventEmitter2` 后 `emit`：

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrderService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createOrder() {
    // 建议事件名用「领域.动作」风格，payload 用具名类，而不是裸 object
    this.eventEmitter.emit('order.created', new OrderCreatedEvent({ orderId: 1, payload: {} }));
  }
}
```

**约定建议：**

- 事件名用点分命名空间（`order.created` / `user.removed`），配合通配符更好用
- payload 定义成 `XxxEvent` 类（而非 `any`），监听者拿到的类型才有意义
- `emit` 本身是**同步**触发所有监听者（监听者内部可以是 `async`，见下）

---

## 4. 监听事件（`@OnEvent`）

```typescript
import { OnEvent } from '@nestjs/event-emitter';

@OnEvent('order.created')
handleOrderCreatedEvent(payload: OrderCreatedEvent) {
  // 处理 OrderCreatedEvent
}
```

> **限制**：事件监听方法所在的 Provider **不能是 request-scoped**。

### 4.1 通配符 / 命名空间

需要先在 `forRoot({ wildcard: true })` 开启：

```typescript
// 匹配 order.created / order.shipped，但不匹配 order.delayed.out_of_stock
@OnEvent('order.*')
handleOrderEvents(payload: OrderCreatedEvent | OrderRemovedEvent) {}

// 多级通配符，匹配任意深度
@OnEvent('order.**')
handleAllOrderEvents(payload: unknown) {}

// 监听所有事件（排障/审计兜底用，慎用）
@OnEvent('**')
handleEverything(payload: unknown) {}
```

### 4.2 `@OnEvent` 第二参数（`OnEventOptions`）

| 选项              | 作用                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `async`           | `true` 时该监听者以异步方式处理（不阻塞其他同步监听者顺序执行完）                                         |
| `prependListener` | `true` 时把该监听者插到监听者数组最前面，而不是追加到最后                                                 |
| `suppressErrors`  | 默认 `true`：监听者内部抛错不会向上抛出；设 `false` 会抛错（需要自己 catch，否则可能影响其他监听者/进程） |

```typescript
@OnEvent('order.created', { async: true, suppressErrors: false })
async handleOrderCreatedEvent(payload: OrderCreatedEvent) {
  // 异步处理；这里的异常需要自己兜住，否则会向外抛
}
```

其余方法（`waitFor`、`onAny` 等）来自底层 `EventEmitter2`，详见其 [文档](https://github.com/EventEmitter2/EventEmitter2)。

---

## 5. 防止事件丢失（启动阶段）

模块的构造函数 / `onModuleInit` 里 `emit` 的事件，可能因为 `EventSubscribersLoader` 还没装完监听器而被漏掉。用 `EventEmitterReadinessWatcher` 兜底：

```typescript
await this.eventEmitterReadinessWatcher.waitUntilReady();
this.eventEmitter.emit('order.created', new OrderCreatedEvent({ orderId: 1, payload: {} }));
```

只有**在 `onApplicationBootstrap` 完成之前**触发的事件才需要这样处理；正常请求路径里的 `emit`（HTTP 请求到来时进程早已启动完毕）不用管。

---

## 6. 选型速查

```
一件事发生后要做什么？
├─ 只想让同进程内其他模块知道、各自反应，丢了也能接受 → Events
├─ 监听者里要执行慢活 / 需要重试 / 需要跨进程消费    → Events 里 emit，再在监听者内 queue.add()
├─ 要到点才触发                                       → Task scheduling（emit 亦可作为触发动作）
└─ 需要持久化、多实例共享、严格保证执行                → 直接用 Queues，不要只靠 Events
```

**判断口诀**：Events 解决「谁该知道这件事」（解耦），Queues 解决「这件事怎么可靠地被做完」（可靠性）。二者不互斥，常常是 `emit` 之后某个监听者转手 `queue.add()`。

---

## 7. 本仓库真实开发场景

本仓库目前模块间是**直接注入 Service** 的强耦合方式（如 `UserService` 直接注入 `AuditService`、`PermissionMenuCacheService`）。引入事件后可以把「一个动作触发的多个副作用」拆开，而不用互相 import。

### 7.1 高优先级（现状已埋雷，接入事件收益明显）

| 场景                                 | 依据                                                                                                                                  | 建议写法                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **删用户 / 封号时使其 Session 失效** | `SessionService.invalidateAllForUser()` 已实现，但 `UserService.remove()` 未接线（见 [task-scheduling.md](./task-scheduling.md) 6.1） | `UserService.remove()` 里 `emit('user.removed', ...)`；`SessionService` 监听并调用 `invalidateAllForUser`，避免 `UserModule` 反向依赖 `SessionModule` |
| **用户增删改统一审计**               | 目前 `AuditService.log()` 由各 Service 显式调用，散落在 `create/update/remove` 里                                                     | 可选：改成 `emit('user.created' / 'user.updated' / 'user.removed')`，由专门的审计监听者统一记录，业务 Service 更干净（非强制，视团队习惯）            |
| **权限菜单缓存失效解耦**             | 目前 `PermissionMenuCacheService.invalidateUser()` 由 `UserService` 直接调用                                                          | 若未来缓存失效逻辑变多（不止用户相关），可改成监听 `user.*` / `role.*` 事件统一处理                                                                   |

### 7.2 中优先级（模块变多后再考虑）

| 场景                     | 建议                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| 角色权限变更通知多处缓存 | `role.updated` 事件，多个监听者各自 invalidate 自己的缓存维度                                    |
| 未验证邮箱提醒触发       | `emit('user.registered')` → 监听者 `queue.add()` 丢进 `mail` 队列（见 [queues.md](./queues.md)） |
| 文件上传后的衍生处理     | 上传成功 `emit('file.uploaded')`，监听者各自做缩略图、病毒扫描等（重活转 Queues）                |

### 7.3 不要用 Events 的（避免误用）

| 场景                                             | 原因                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 请求内必须保证的强一致操作（如扣库存和创建订单） | Events 默认同步但不天然带事务边界；跨聚合强一致应放同一事务或用 Saga，不要仅靠事件           |
| 需要持久化、重试、多实例消费的重活               | 直接用 Queues；Events 进程重启即丢，没有重试机制                                             |
| 需要严格保证「必须被处理」的关键动作             | 事件监听者可以被漏订阅、可以静默吃掉异常（`suppressErrors` 默认 `true`），关键路径不能只靠它 |

### 7.4 推荐落地顺序

```
1. 删用户 / 封号 → Session 失效：接入 emit('user.removed') + SessionService 监听（解决现有 TODO）
2. 视团队习惯，评估是否把审计 log 也改成事件驱动
3. 模块进一步拆分、监听者变重时，再考虑「emit → 队列」组合
```

---

## 8. 正式开发中的通用场景（不限本仓库）

### 8.1 领域事件 / 模块解耦

| 场景                                 | 说明                                                         |
| ------------------------------------ | ------------------------------------------------------------ |
| 下单成功后扣库存、发通知、记积分     | 一个 `order.created`，多个监听者各管一段，互不感知           |
| 用户注册后发欢迎邮件、初始化默认设置 | `user.registered` 事件，新增副作用只需加监听者，不改原有代码 |
| 状态机流转通知                       | 订单状态变更、审批流程节点变化，广播给多个关心的模块         |

### 8.2 审计与可观测

| 场景             | 说明                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| 统一审计日志埋点 | 领域事件天然是审计埋点位置，比在每个 Service 里手写 `log()` 更集中     |
| 埋点 / 统计计数  | 页面访问、功能使用次数等「顺带做一下」的统计，用事件监听而非侵入主流程 |

### 8.3 缓存与状态同步

| 场景                 | 说明                                                           |
| -------------------- | -------------------------------------------------------------- |
| 写操作后失效相关缓存 | 权限、菜单、配置变更后 `emit`，多个缓存监听者各自 `invalidate` |
| 模块间状态广播       | 一个模块的状态变化需要通知另一个模块调整内部状态，但不想强耦合 |

### 8.4 与 Queues / Task scheduling 组合

| 场景             | 说明                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| 事件触发异步任务 | `emit` 之后，监听者判断是慢活就转手 `queue.add()`（如发信、生成报表）       |
| 定时任务广播     | Cron 到点 `emit` 一个事件，让多个模块各自响应，而不是 Cron 里堆一堆 if-else |

### 8.5 选型口诀（正式项目）

```
多个模块要对同一件事各自反应、彼此解耦          → Events
副作用是慢活 / 必须可靠执行 / 要跨进程            → Events 里 emit，监听者转 Queue
必须强一致、不能丢、不能被静默吃掉异常            → 别只用 Events；用事务 / 显式调用 / Saga
只是「到点做什么」，不是「发生了什么」            → Task scheduling
```

---

## 9. 生产注意

1. **异常不会自动冒泡**：`@OnEvent` 默认 `suppressErrors: true`，监听者内部抛错默认被吞掉，容易「静默失败」。关键监听者要自己 try-catch + 记日志/告警，或显式设 `suppressErrors: false` 并在外层兜底。
2. **不保证顺序和事务性**：`emit` 是同步调用所有监听者，但监听者之间无事务关联；某个监听者失败不会回滚已成功的其他监听者，也不会重试。
3. **进程内、重启即丢**：不落盘。需要「即使进程重启也不能丢」的场景，别用 Events，用 Queues。
4. **request-scoped 限制**：监听者所在 Provider 不能是 request-scoped。
5. **通配符和 `maxListeners`**：事件命名规范（点分命名空间）从一开始就要定好，避免后期迁移到通配符订阅时到处改字符串；监听者多的事件适当调大 `maxListeners` 避免误报内存泄漏。
6. **启动期 `emit` 用 `EventEmitterReadinessWatcher`**：避免应用启动阶段（`onModuleInit` 等）触发的事件被漏订阅。

---

## 10. 最小落地清单（需要时）

1. 安装 `@nestjs/event-emitter`，`AppModule` 里 `EventEmitterModule.forRoot()`
2. 定义事件类（如 `UserRemovedEvent`），事件名用点分命名空间（如 `user.removed`）
3. 触发方（如 `UserService.remove()`）注入 `EventEmitter2`，`emit`
4. 监听方（如 `SessionService`）用 `@OnEvent('user.removed')` 处理，注意异常自己兜住
5. 若监听者里逻辑变重 / 需要重试，再评估要不要转手丢进 Queue

---

## 11. 延伸阅读

- 官方文档：[Events](https://docs.nestjs.com/techniques/events)
- 底层库：[EventEmitter2](https://github.com/EventEmitter2/EventEmitter2)
- 常一起看：[Task scheduling](./task-scheduling.md)、[Queues](./queues.md)
- 学习路径：[未来学习计划](./未来学习计划.md)
- Session：[session 认证方案总结](../back/邮箱（账号）、密码登录注册功能/session-认证方案总结.md)
