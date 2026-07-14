# NestJS Queues（队列）

基于官方 [Queues](https://docs.nestjs.com/techniques/queues) 整理。读完应能回答：

- BullMQ 和 Bull 怎么选？Producer / Consumer / Listener 各干什么？
- Job 的 `delay` / `attempts` / `priority` / `repeat` 分别什么时候用？
- 和 Task scheduling、Events 怎么分工？本仓库什么时候该上队列？

> 官方更详细的底层文档：[BullMQ](https://docs.bullmq.io/) / [Bull REFERENCE](https://github.com/OptimalBits/bull/blob/master/REFERENCE.md)  
> 本仓库现状：已有 Redis（权限缓存、限流），**尚未**接入 `@nestjs/bullmq`（见 [未来学习计划](./未来学习计划.md) P1）

---

## 1. 它解决什么问题

把「现在立刻做完」改成「先入队，再由 worker 可控地消费」：

| 场景       | 典型例子                              |
| ---------- | ------------------------------------- |
| 削峰       | 高峰时大量发邮件 / 导出，避免打满 API |
| 解耦慢活   | 音频转码、大表归档、调慢第三方 API    |
| 可靠重试   | 短信失败自动 backoff 再试             |
| 跨进程通信 | API 进程入队，独立 worker 消费        |

Nest 提供两套封装（同一团队维护）：

| 包                                                                          | 状态                          | 建议                 |
| --------------------------------------------------------------------------- | ----------------------------- | -------------------- |
| [`@nestjs/bullmq`](https://www.npmjs.com/package/@nestjs/bullmq) + `bullmq` | **积极开发**，TypeScript 优先 | **新项目优先用这个** |
| [`@nestjs/bull`](https://www.npmjs.com/package/@nestjs/bull) + `bull`       | 维护模式（修 bug）            | 已有项目可继续用     |

两者都以 **Redis** 持久化 Job。同名队列连同一 Redis 即共享：多实例、多机器都能生产/消费。

**和周边能力的边界：**

| 能力                | 职责                                         |
| ------------------- | -------------------------------------------- |
| **Queues**          | 异步执行、重试、削峰、多 worker              |
| **Task scheduling** | 到点触发（定时器）；重活应「cron → 入队」    |
| **Events**          | 进程内解耦广播；不保证落盘、不跨进程、不重试 |

常见组合：HTTP/事件触发入队 → Consumer 干活；或 Cron 只负责「到点入队」。

---

## 2. 安装与启用（BullMQ）

```bash
npm install --save @nestjs/bullmq bullmq
```

根模块配置 Redis 连接（本仓库可与现有 `REDIS_HOST` / `REDIS_PORT` 对齐）：

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
  ],
})
export class AppModule {}
```

`forRoot()` 常用字段（均可选，会传给 BullMQ `Queue`）：

| 字段                              | 作用                                         |
| --------------------------------- | -------------------------------------------- |
| `connection`                      | Redis 连接                                   |
| `prefix`                          | 所有队列 key 前缀（多环境共用 Redis 时有用） |
| `defaultJobOptions`               | 新建 Job 的默认选项                          |
| `extraOptions.manualRegistration` | 关闭自动注册，改用 `BullRegistrar` 手动注册  |

注册具体队列：

```typescript
BullModule.registerQueue({
  name: 'audio',
});

// 可覆盖该队列的连接等
BullModule.registerQueue({
  name: 'audio',
  connection: { port: 6380 },
});
```

- 队列按 **`name` 唯一**；同名 + 同一 Redis = 共享队列
- `name` 既是注入 token（`@InjectQueue('audio')`），也是 `@Processor('audio')` 的关联键
- 进程重启后会继续处理 Redis 里未完成的 Job

**父子 Job / Flow**（BullMQ 能力）：用 `BullModule.registerFlowProducer({ name: '...' })`，详见 [Flows](https://docs.bullmq.io/guide/flows)。

### 2.1 命名配置（多 Redis）

```typescript
BullModule.forRoot('alternative-config', {
  connection: { port: 6381 },
});

BullModule.registerQueue({
  configKey: 'alternative-config',
  name: 'video',
});
```

### 2.2 异步配置（对接 ConfigModule）

```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    connection: {
      host: configService.get('QUEUE_HOST'),
      port: configService.get('QUEUE_PORT'),
    },
  }),
  inject: [ConfigService],
});

// 也可 useClass / useExisting；单队列用 registerQueueAsync
// 注意：name 写在 factory 外
BullModule.registerQueueAsync({
  name: 'audio',
  useFactory: () => ({
    connection: { host: 'localhost', port: 6379 },
  }),
});
```

---

## 3. Producer（生产者）

把 Job 丢进队列，通常是 Service：

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AudioService {
  constructor(@InjectQueue('audio') private audioQueue: Queue) {}

  async enqueueTranscode() {
    // 第一个参数：job name（消费者里用 switch 分流）
    // 第二个参数：可序列化的业务数据
    const job = await this.audioQueue.add('transcode', {
      foo: 'bar',
    });
    return job.id;
  }
}
```

Job 数据必须能序列化进 Redis（普通对象 / 基本类型即可）。

---

## 4. Job options（入队选项）

`add(name, data, options)` 的第三参数常用项：

| 选项               | 作用                                        |
| ------------------ | ------------------------------------------- |
| `priority`         | 1 最高 … 数字越大越低；有轻微性能成本，慎用 |
| `delay`            | 延迟 N ms 后再可被消费（时钟要大致同步）    |
| `attempts`         | 最多尝试次数（含首次）                      |
| `backoff`          | 失败后退避策略（固定 / 指数等）             |
| `repeat`           | 按 cron / 间隔重复（队列版「定时任务」）    |
| `lifo`             | `true` 时 LIFO，默认 FIFO                   |
| `jobId`            | 自定义 ID；**已存在则不会再加**（可做幂等） |
| `removeOnComplete` | 成功后删除，或保留最近 N 条                 |
| `removeOnFail`     | 最终失败后删除，或保留最近 N 条             |
| `stackTraceLimit`  | 记录的堆栈行数上限                          |

```typescript
await this.audioQueue.add(
  'transcode',
  { foo: 'bar' },
  { delay: 3000, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
);

await this.audioQueue.add('transcode', { foo: 'bar' }, { lifo: true });
await this.audioQueue.add('transcode', { foo: 'bar' }, { priority: 2 });
```

完整选项见 [JobsOptions](https://api.docs.bullmq.io/types/v4.JobsOptions.html)。

---

## 5. Consumer（消费者）

Consumer 是带 `@Processor(queueName)` 的 **类**，必须注册为 `providers`。BullMQ 要求继承 `WorkerHost`，在 **`process`** 里处理：

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('audio')
export class AudioConsumer extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    let progress = 0;
    for (let i = 0; i < 100; i++) {
      await doSomething(job.data);
      progress += 1;
      await job.updateProgress(progress);
    }
    return {}; // 返回值会存进 job，completed 事件可读到
  }
}
```

### 5.1 按 job name 分流（BullMQ 重要差异）

旧版 Bull 可用 `@Process('transcode')` 只处理某类 Job。  
**BullMQ 不支持**，官方要求在 `process` 里 `switch (job.name)`：

```typescript
@Processor('audio')
export class AudioConsumer extends WorkerHost {
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case 'transcode':
        // ...
        return {};
      case 'concatenate':
        await doSomeLogic2();
        break;
      default:
        // 未知 name：打日志或抛错，避免静默吞掉
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
```

消费顺序：默认 FIFO；可用 `lifo` / `priority` 调整。详见 [named processor](https://docs.bullmq.io/patterns/named-processor)。

### 5.2 Request-scoped Consumer

每个 Job 新建一个实例，结束后可回收：

```typescript
@Processor({
  name: 'audio',
  scope: Scope.REQUEST,
})
export class AudioConsumer extends WorkerHost {
  constructor(@Inject(JOB_REF) jobRef: Job) {
    super();
    console.log(jobRef);
  }
  // ...
}
```

`JOB_REF` 从 `@nestjs/bullmq` 导入。

### 5.3 独立进程 Processor（沙箱）

适合 CPU 密集 / 怕拖垮主进程：

```typescript
BullModule.registerQueue({
  name: 'audio',
  processors: [join(__dirname, 'processor.js')],
});
```

**注意：** fork 出去的进程 **没有 Nest DI**，依赖要自己在 processor 文件里创建。见 [Sandboxed processors](https://docs.bullmq.io/guide/workers/sandboxed-processors)。

---

## 6. 事件监听

### 6.1 Worker 级：`@OnWorkerEvent`（写在 Consumer 里）

```typescript
import { Processor, OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('audio')
export class AudioConsumer extends WorkerHost {
  async process(job: Job) {
    /* ... */
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    console.log(`Processing job ${job.id} of type ${job.name}`);
  }
}
```

事件列表见 [WorkerListener](https://api.docs.bullmq.io/interfaces/v4.WorkerListener.html)。

### 6.2 Queue 级：`@QueueEventsListener` + `QueueEventsHost`

```typescript
import { QueueEventsHost, QueueEventsListener, OnQueueEvent } from '@nestjs/bullmq';

@QueueEventsListener('audio')
export class AudioEventsListener extends QueueEventsHost {
  @OnQueueEvent('active')
  onActive(job: { jobId: string; prev?: string }) {
    console.log(`Processing job ${job.jobId}...`);
  }
}
```

同样必须注册为 `providers`。事件列表见 [QueueEventsListener](https://api.docs.bullmq.io/interfaces/v4.QueueEventsListener.html)。

---

## 7. 队列管理与手动注册

```typescript
await audioQueue.pause(); // 暂停接新活；进行中的会跑完
await audioQueue.resume();
```

更多 API：[Queue](https://api.docs.bullmq.io/classes/v4.Queue.html)（查各状态 Job 数、清理等）。

默认在 `onModuleInit` 自动注册队列 / processor / listener。若要条件启动：

```typescript
BullModule.forRoot({
  extraOptions: { manualRegistration: true },
});

// 某 Service 的 onModuleInit：
this.bullRegistrar.register(); // 不调用则不会消费任何 Job
```

---

## 8. 选型速查

```
要异步做什么？
├─ 请求里立刻返回、后台慢慢做（邮件/导出/转码）→ Queue Producer + Consumer
├─ 失败要自动重试 / 退避 → attempts + backoff
├─ 延迟 N 秒后再做（关单倒计时类）→ delay 或 delayed job
├─ 按日历重复（等价「队列版 cron」）→ repeat；或 @Cron 只负责入队
├─ 同一业务只允许一个在途 Job → 自定义 jobId（已存在则不加）
├─ 纯进程内解耦、不需要落盘/重试 → Events 即可
└─ 轻量到点打扫、无重试需求 → Task scheduling 即可
```

**Bull vs BullMQ：** 新代码用 BullMQ；本文以 BullMQ 为准。Bull 的 `@Process('name')` 命名处理器、根配置字段叫 `redis`（不是 `connection`）等差异，需要时再查官方同页 Bull 章节。

---

## 9. 本仓库真实开发场景

本仓库已有 Redis，上队列的边际成本主要是依赖与模块接线，而不是再装一套中间件。

### 9.1 高优先级（功能一上来就该队列）

| 场景                       | 依据                                                                | 建议                                               |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| **发邮件 / 验证码 / 通知** | 注册、重置密码、未验证邮箱提醒；SMTP 慢且易失败                     | `mail` 队列：`attempts` + `backoff`；HTTP 只 `add` |
| **审计日志批量归档**       | `audit_logs` 只增不删（见 [task-scheduling](./task-scheduling.md)） | Cron 触发 → `audit-archive` 队列分批删/导出        |
| **大文件 / 头像孤儿清理**  | 扫盘 + 差集可能慢                                                   | Cron 入队；Consumer 限并发扫目录                   |

### 9.2 中优先级

| 场景                               | 建议                                        |
| ---------------------------------- | ------------------------------------------- |
| Excel / CSV 导出                   | 入队生成文件，完成后通知或给下载链          |
| 调慢的第三方 API（短信、支付查单） | 队列限流 + 重试，避免堵请求线程             |
| 权限相关「重算/预热」批量任务      | 写路径仍即时 `invalidate`；全量预热可走队列 |

### 9.3 不要用队列的（避免过度设计）

| 能力                 | 原因                                 |
| -------------------- | ------------------------------------ |
| 权限菜单单次读写缓存 | 已有 `PermissionMenuCache`，同步即可 |
| 限流计数             | Throttler + Redis TTL                |
| JWT 校验             | 请求路径同步完成                     |
| 仅模块内解耦且同进程 | 先看 Events                          |

### 9.4 推荐落地顺序

```
1. mail（或 notification）队列：注册/重置密码异步发信
2. 与 Cron 组合：Session purge / 孤儿文件 — 轻则 pure cron，重则入队
3. 导出 / 第三方集成变多后再拆独立 worker 进程
```

---

## 10. 正式开发中的通用场景（不限本仓库）

### 10.1 通知与消息

| 场景               | 说明                               |
| ------------------ | ---------------------------------- |
| 邮件 / 短信 / 推送 | 经典队列场景；失败重试几乎刚需     |
| 站内信批量下发     | 削峰，避免一次插上万行堵库         |
| Webhook 出站       | 对方宕机靠 `attempts` + DLQ/失败集 |

### 10.2 订单 / 支付 / 电商

| 场景                 | 说明                                   |
| -------------------- | -------------------------------------- |
| 超时关单             | `delay` 入队关单，或 cron 扫 + 入队    |
| 支付结果异步通知处理 | 入队保证幂等消费（`jobId` = 支付单号） |
| 库存回滚、积分发放   | 与主事务解耦，失败可补偿               |

### 10.3 媒体与计算

| 场景                   | 说明                                          |
| ---------------------- | --------------------------------------------- |
| 转码、缩略图、PDF 生成 | CPU 密集会堵 event loop → 队列 + 可选沙箱进程 |
| AI/推理调用            | 限并发、排队，保护配额                        |

### 10.4 数据与同步

| 场景                | 说明                     |
| ------------------- | ------------------------ |
| 对账、报表、ES 重建 | cron → 队列；独立 worker |
| CRM/ERP 同步        | 限频拉第三方             |
| 大表归档 / 分批迁移 | 分页 Job，可暂停队列     |

### 10.5 选型口诀

```
HTTP 请求路径里的慢 I/O、易失败外部调用     → 必须队列
要可靠重试 / 削峰 / 多副本消费               → 必须队列
到点触发且逻辑很轻（改状态、小 SQL）         → cron 即可
到点触发且逻辑很重                           → cron + 队列
只想解耦模块、同进程、丢了也能接受             → Events
多副本下「同一 Job 只处理一次」               → Redis 队列天然支持；注意幂等
```

---

## 11. 生产注意（本仓库相关）

1. **复用现有 Redis**：可与缓存同实例，建议用 `prefix`（如 `bull:`）隔离 key；流量大时再拆 DB index 或独立实例。
2. **Consumer 要幂等**：至少一次投递；用业务唯一键或 `jobId` 防重复副作用。
3. **别在 API 进程里塞重 CPU**：转码类用独立 worker 或 `processors` 沙箱。
4. **可观测**：监听 `failed` / `completed`，结合 Winston；监控队列深度（积压告警）。
5. **完成集膨胀**：生产环境设 `removeOnComplete` / `removeOnFail`，避免 Redis 被历史 Job 撑满。
6. **与 Cron 分工**：调度器保持轻量，只 `add`；真正干活在 Consumer（见 [task-scheduling](./task-scheduling.md)）。
7. **时区 / 延迟**：`delay` / `repeat` 依赖时钟；容器注意 NTP；日历对齐仍可用 `@Cron` + 入队。

---

## 12. 最小落地清单（需要时）

1. 安装 `@nestjs/bullmq` + `bullmq`
2. `BullModule.forRootAsync` 接现有 Redis 配置；`registerQueue({ name: 'mail' })`
3. `MailService` 里 `@InjectQueue('mail')` + `add`；`MailConsumer extends WorkerHost`
4. 给发信 Job 配 `attempts` / `backoff` / `removeOnComplete`
5. 本地用 Redis 看 key / 日志确认消费；再考虑独立 worker 进程

---

## 13. 延伸阅读

- 官方文档：[Queues](https://docs.nestjs.com/techniques/queues)
- 常一起看：[Task scheduling](./task-scheduling.md)、[Events](./events.md)
- 学习路径：[未来学习计划](./未来学习计划.md)
- BullMQ 指南：[docs.bullmq.io](https://docs.bullmq.io/)
