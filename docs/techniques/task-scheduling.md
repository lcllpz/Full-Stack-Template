# NestJS Task Scheduling（定时任务）

基于官方 [Task scheduling](https://docs.nestjs.com/techniques/task-scheduling) 整理。读完应能回答：

- `@Cron` / `@Interval` / `@Timeout` 分别干什么、怎么选？
- 声明式任务和动态 `SchedulerRegistry` 有什么区别？
- 多实例部署时要注意什么？和 Queues 怎么分工？

> 官方示例：[nestjs/nest sample/27-scheduling](https://github.com/nestjs/nest/tree/master/sample/27-scheduling)  
> 本仓库现状：尚未接入 `@nestjs/schedule`（见 [未来学习计划](./未来学习计划.md) P1）

---

## 1. 它解决什么问题

在应用进程内，按时间自动执行一段代码：

| 场景           | 典型例子                    |
| -------------- | --------------------------- |
| 固定日历时间   | 每天 3:00 清理过期 token    |
| 固定间隔       | 每 10 秒健康检查 / 同步状态 |
| 启动后延迟一次 | 启动 5 秒后预热缓存         |

Linux 上常用系统 `cron`；Node 里 Nest 用 [`@nestjs/schedule`](https://www.npmjs.com/package/@nestjs/schedule)（底层对接 [cron](https://github.com/kelektiv/node-cron)）在**应用内**调度。

**和 Queues 的边界：**

- **Task scheduling**：到点触发（定时器）
- **Queues（Bull/BullMQ）**：异步执行、重试、削峰、多 worker

常见组合：Cron 只负责「到点入队」，真正干活放队列。

---

## 2. 安装与启用

```bash
npm install --save @nestjs/schedule
```

在根模块启用（`forRoot()` 会在 `onApplicationBootstrap` 时注册所有声明式任务）：

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
})
export class AppModule {}
```

业务任务写在任意 `@Injectable()` 的 Provider 里即可（如 `TasksService`），并确保该 Provider 被某个 Module 注册。

---

## 3. 三种声明式任务

### 3.1 `@Cron` — 按 cron 表达式（最常用）

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  // 每分钟的第 45 秒
  @Cron('45 * * * * *')
  handleCron() {
    this.logger.debug('Called when the current second is 45');
  }

  // 或用内置枚举
  @Cron(CronExpression.EVERY_30_SECONDS)
  handleEvery30s() {
    this.logger.debug('Called every 30 seconds');
  }
}
```

**表达式字段（秒可选）：**

```text
* * * * * *
│ │ │ │ │ │
│ │ │ │ │ └─ 星期 (0-7, 0 和 7 = 周日)
│ │ │ │ └─── 月
│ │ │ └───── 日
│ │ └─────── 时
│ └───────── 分
└─────────── 秒（可选）
```

| 表达式              | 含义                  |
| ------------------- | --------------------- |
| `* * * * * *`       | 每秒                  |
| `45 * * * * *`      | 每分钟第 45 秒        |
| `0 10 * * * *`      | 每小时第 10 分整      |
| `0 */30 9-17 * * *` | 9–17 点之间每 30 分钟 |
| `0 30 11 * * 1-5`   | 周一到周五 11:30      |

也可传入 `Date`：**只执行一次**（例如启动后 10 秒：`@Cron(new Date(Date.now() + 10_000))`）。

**可选第二参数：**

| 选项                | 作用                                            |
| ------------------- | ----------------------------------------------- |
| `name`              | 命名，便于之后用 `SchedulerRegistry` 启停       |
| `timeZone`          | 时区（如 `Asia/Shanghai`）                      |
| `utcOffset`         | 用偏移代替 `timeZone`                           |
| `waitForCompletion` | `true` 时：当前次未跑完则跳过后续触发（防重叠） |
| `disabled`          | 是否禁用                                        |

```typescript
@Cron('* * 0 * * *', {
  name: 'notifications',
  timeZone: 'Asia/Shanghai',
  waitForCompletion: true,
})
triggerNotifications() {}
```

`@Cron` / `@Interval` / `@Timeout` 方法都会被包一层 `try-catch`，异常会打到控制台，**不会**把进程打崩；业务侧仍应自己记日志 / 告警。

### 3.2 `@Interval` — 固定毫秒间隔（底层 `setInterval`）

```typescript
@Interval(10_000)
handleInterval() {
  this.logger.debug('Called every 10 seconds');
}

// 需要动态控制时加 name
@Interval('notifications', 2500)
handleNamedInterval() {}
```

适合「相对启动后每隔 N ms」；要按墙钟对齐（整点、营业时间）优先用 `@Cron`。

### 3.3 `@Timeout` — 启动后延迟一次（底层 `setTimeout`）

```typescript
@Timeout(5000)
handleTimeout() {
  this.logger.debug('Called once after 5 seconds');
}

@Timeout('warmup', 2500)
handleWarmup() {}
```

适合预热、一次性初始化，不是周期任务。

---

## 4. 动态 API：`SchedulerRegistry`

注入后可：**查 / 启停 / 改时间 / 增删** 声明式或运行时创建的任务。

```typescript
constructor(private schedulerRegistry: SchedulerRegistry) {}
```

### 4.1 Cron

```typescript
// 获取已命名的声明式任务
const job = this.schedulerRegistry.getCronJob('notifications');
job.stop();
job.start();
job.lastDate();
job.nextDate();

// 运行时创建（CronJob 来自 `cron` 包）
import { CronJob } from 'cron';

addCronJob(name: string, seconds: string) {
  const job = new CronJob(`${seconds} * * * * *`, () => {
    this.logger.warn(`job ${name} fired`);
  });
  this.schedulerRegistry.addCronJob(name, job);
  job.start();
}

this.schedulerRegistry.deleteCronJob(name);
this.schedulerRegistry.getCronJobs(); // Map
```

`CronJob` 常用方法：`stop` / `start` / `setTime` / `lastDate` / `nextDate` / `nextDates(n)`。

### 4.2 Interval / Timeout

模式相同：`getInterval` / `addInterval` / `deleteInterval` / `getIntervals`，以及对应的 `*Timeout*`。动态创建时自己 `setInterval` / `setTimeout`，再交给 Registry 托管命名。

---

## 5. 选型速查

```
要定时做什么？
├─ 按日历/时区对齐（每天 3 点、工作日 11:30）→ @Cron
├─ 相对时间、固定间隔轮询 → @Interval（或 CronExpression）
├─ 启动后只跑一次 → @Timeout
├─ 运行时由管理员开关、改表达式 → SchedulerRegistry + name / 动态创建
└─ 任务重、要重试、多实例消费 → Cron 触发 + Queues 执行
```

---

## 6. 本仓库真实开发场景

JWT 过期、限流 TTL、权限写时失效、Winston 日志轮转 —— **请求时或中间件已处理，不必用 cron**。  
下面是对照现有模块，开发中真正会用到定时任务的场景。

### 6.1 高优先级（上线很快会碰到）

| 场景                          | 依据                                                                                                                                                  | 建议写法                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **清理过期 / 已登出 Session** | 登出只 `softDelete`；表无 `expiresAt`；文档已写「需定期清理」([session 认证方案总结](../back/邮箱（账号）、密码登录注册功能/session-认证方案总结.md)) | 夜间 `@Cron`：硬删「软删超过保留期」或「`updatedAt` 早于 refresh TTL（默认 7d）」的行 |
| **回收公开上传孤儿头像**      | `POST /file/upload/avatar/public` 无 owner、无 DB 记录；文档建议定时回收（[文件上传](../back/文件上传/index.md)）                                     | `@Cron` 扫 `uploads/avatars/`，与 `users.avatar` 做差集后删除；量大再改 cron→queue    |
| **删用户 / 封号作废 Session** | `invalidateAllForUser()` 已有，但 `UserService.remove()` 未接线                                                                                       | **事件驱动优先**（删用户时同步调用）；cron 只做兜底扫描                               |

### 6.2 中优先级（数据量 / 合规上来再做）

| 场景                          | 依据                                                      | 建议写法                                     |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| **审计日志归档**              | `audit_logs` 只增不删，会膨胀                             | cron 触发 + queue 分批导出/删除              |
| **软删实体硬删除**            | `users` / `roles` / `menus` / `sessions` 均有 `deletedAt` | 如软删 >90 天再 `hardDelete`（pure cron）    |
| **已删用户头像文件回收**      | 用户软删后磁盘文件可能残留                                | 关联 `users.deletedAt` + 文件 key 清理       |
| **封禁用户 Session 兜底下线** | `UserStatus.BANNED` 已有，JWT 校验未查 status             | 封号时同步 invalidate；cron 扫仍有效 session |

### 6.3 低优先级 / 扩展

| 场景                     | 说明                                                   |
| ------------------------ | ------------------------------------------------------ |
| 未验证邮箱提醒 / 清理    | `emailVerified` 已预留，需发信模块 → **cron + queue**  |
| 启动后预热权限缓存       | `@Timeout`，可选                                       |
| 内部健康探测（Redis/DB） | `@Interval` + Winston 告警；对外仍可保留 `GET /health` |

### 6.4 不要用 cron 的（避免误用）

| 能力               | 原因                                   |
| ------------------ | -------------------------------------- |
| JWT / Refresh 过期 | 请求时 Passport 校验                   |
| 权限菜单缓存失效   | 写路径已 `invalidate*`，Redis 自带 TTL |
| 限流计数           | Throttler + Redis TTL                  |
| 应用日志文件轮转   | `winston-daily-rotate-file`            |
| Seeds              | `onApplicationBootstrap` 启动时跑即可  |

### 6.5 推荐落地顺序

```
1. Session purge（文档已点名，纯 SQL 批删）
2. 公开上传孤儿文件回收
3. 删用户时接线 invalidateAllForUser（非 cron，但同属会话闭环）
4. 审计归档 / 软删 purge（数据量驱动；重活走 Queues）
```

---

## 7. 正式开发中的通用场景（不限本仓库）

按业务域归类。多数「重活 / 要重试 / 要削峰」应 **cron 触发 + Queues 执行**；轻量打扫可用 pure cron。

### 7.1 账号与安全

| 场景                              | 说明                                |
| --------------------------------- | ----------------------------------- |
| 过期 Session / Refresh Token 清理 | 与本仓库同类，几乎每个 JWT 系统都要 |
| 登录失败锁定自动解锁              | 如锁定 30 分钟后定时恢复            |
| 强制改密 / 密码过期提醒           | 合规（金融、政企）常见              |
| 异常登录巡检汇总                  | 夜间汇总风控告警，不是实时拦截      |

### 7.2 订单 / 支付 / 电商

| 场景                    | 说明                                         |
| ----------------------- | -------------------------------------------- |
| **未支付订单超时关单**  | 下单 15/30 分钟未付 → 关单释库存（高频刚需） |
| 支付结果对账            | 与微信/支付宝日终对账，发现漏单补单          |
| 库存预占超时释放        | 秒杀/下单锁库存未支付则回滚                  |
| 优惠券 / 活动到期上下架 | 到点改状态，避免靠用户请求才发现过期         |
| 物流状态轮询            | 调快递 API 批量更新（注意限频 → 常走队列）   |

### 7.3 订阅 / SaaS / 计费

| 场景                | 说明                          |
| ------------------- | ----------------------------- |
| 订阅到期降级 / 停用 | 到期改套餐、关功能            |
| 续费提醒            | 到期前 7/3/1 天发邮件或站内信 |
| 用量账单出账        | 按自然日/月聚合用量并生成账单 |
| Trial 试用到期      | 试用结束自动转付费或冻结      |

### 7.4 内容 / 运营 / 通知

| 场景                       | 说明                                   |
| -------------------------- | -------------------------------------- |
| **定时发布**               | 文章/活动到点从 draft → published      |
| 定时上下架 Banner / 广告位 | 运营后台配置起止时间，cron 扫状态      |
| 批量推送 / 营销短信        | 到点触发；发送本身必须走队列           |
| 热搜 / 排行榜重算          | 每小时或每天重算缓存                   |
| 统计报表预聚合             | 日报、周报、大盘指标落库，减轻实时查询 |

### 7.5 数据与存储治理

| 场景                    | 说明                                       |
| ----------------------- | ------------------------------------------ |
| 软删硬删、冷热归档      | 审计、聊天记录、埋点表按保留策略归档       |
| 临时文件 / 导出文件清理 | Excel 导出、压缩包、预览图 TTL             |
| 对象存储孤儿对象回收    | 上传成功但业务未落库、或删除业务未删 OSS   |
| 数据库分区 / 备份触发   | 应用层触发备份脚本或调云 API（常配合运维） |
| 搜索索引全量/增量重建   | ES 夜间全量、白天增量；重任务走 worker     |

### 7.6 集成与外部系统

| 场景                   | 说明                                         |
| ---------------------- | -------------------------------------------- |
| 第三方数据同步         | CRM、ERP、企微通讯录定时拉取                 |
| Webhook 失败补偿重试   | 对方宕机后定时扫失败表再投（更优：队列重试） |
| 汇率 / 行情 / 配置拉取 | 定时拉外部行情写本地缓存                     |
| 证书 / 密钥轮换检查    | SSL、API Key 到期前提醒                      |

### 7.7 运维与可观测

| 场景                      | 说明                                         |
| ------------------------- | -------------------------------------------- |
| 健康巡检与心跳            | 探测依赖；告警（K8s probe 之外的业务级检查） |
| 积压监控                  | 队列深度、死信数量超阈值告警                 |
| 缓存预热                  | 高峰前把热点 Key 打进 Redis                  |
| 清理过期分布式锁 / 幂等键 | 异常宕机留下的锁或幂等记录                   |

### 7.8 选型口诀（正式项目）

```
到点改状态、关单、上下架、到期降级     → 常 pure cron（轻）或 cron→队列（重）
发邮件/短信/推送/调慢第三方 API        → 必须 cron + queue（或事件 + queue）
对账、报表、全量重建索引、大表归档     → cron + 独立 worker / 队列，勿堵 API 进程
实时风控、下单扣库存一致性             → 不要指望 cron；用事务 / 锁 / 事件
多副本部署下的「只跑一次」             → 分布式锁 / 选主 / 独立 scheduler 服务
```

---

## 8. 生产注意（本仓库相关）

1. **多实例会重复跑**：每个 Nest 进程都会各自注册 cron。多副本时需：只跑一个调度实例、或分布式锁（Redis）、或改成「cron → 入队 → 单消费者」。
2. **长任务防重叠**：给 `@Cron` 加 `waitForCompletion: true`，或业务内加锁。
3. **时区**：容器默认常是 UTC，业务按国内时间用 `timeZone: 'Asia/Shanghai'`。
4. **不要在 cron 里塞重逻辑**：清理、对账、发邮件等适合入 Bull/BullMQ，调度器保持轻量。
5. **与本仓库日志**：任务方法里用现有 Winston/`Logger`，便于和 HTTP 审计区分排查。

---

## 9. 最小落地清单（需要时）

1. 安装 `@nestjs/schedule`，`AppModule` 里 `ScheduleModule.forRoot()`
2. 新建 `TasksModule` + `TasksService`，先做 **Session purge**（带 `name` + `waitForCompletion`）
3. 本地日志确认触发；再补时区 `Asia/Shanghai`
4. 若要上多实例：先设计「单调度」或「锁 / 队列」，再扩副本

---

## 10. 延伸阅读

- 官方文档：[Task scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- 下一步常一起看：[Queues](./queues.md)、[Events](./events.md)
- 学习路径：[未来学习计划](./未来学习计划.md)
- Session：[session 认证方案总结](../back/邮箱（账号）、密码登录注册功能/session-认证方案总结.md)
- 文件：[文件上传](../back/文件上传/index.md)
