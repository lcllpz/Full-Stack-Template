# 登录 / 注册功能增强 —— 实施计划

> 基于现有 NestJS 后端（Passport-Local + JWT + Session + Redis + Throttle）扩展多种登录、注册、找回密码与账号绑定能力。
>
> 状态：**已实现**（阶段 0–7 全部完成，端到端冒烟测试 18/18 通过）。

---

## 一、方案决策（已与需求方确认）

| 决策项            | 选择                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 邮件发送          | **真实 SMTP**（Nodemailer），账号/授权码通过环境变量注入                                                                                      |
| 短信发送          | **抽象 `SmsProvider` 接口**，dev 用控制台 mock，生产预留 阿里云/腾讯云 实现                                                                   |
| 发送方式          | **BullMQ 队列异步发送**（顺便实践 `docs/techniques/queues.md`）                                                                               |
| 注册流程          | **两步式**：先发邮箱验证码 → 再提交（邮箱+验证码+密码+昵称）建号，避免垃圾账号                                                                |
| 换绑邮箱/手机     | **双重验证**：发旧码（可选）→ 发新码 → **确认时**同时校验「旧渠道验证码 **或** 登录密码」+「新渠道验证码」（旧身份两种都支持、前端自选）      |
| 图形验证码        | **后端自生成 SVG 图形验证码**（`svg-captcha` + Redis），作为所有"发送验证码"接口的前置校验，防刷                                              |
| 验证码派发（dev） | **邮件**：本地用 [MailDev](https://github.com/maildev/maildev) 收信（`deploy/maildev`）；未配 SMTP 时回退 logger。**短信**：dev mock 打控制台 |
| 昵称              | 注册时 **必填**                                                                                                                               |
| 账号存在性        | 发码时即校验邮箱/手机是否存在：登录/换绑场景不存在直接提示"未注册"（枚举风险由图形验证码兜底）                                                |

---

## 二、目标功能清单（审核后的最终形态）

对原始需求做了去重与语义澄清：原「第2、3 组的密码修改」本质是"忘记密码的邮箱/手机渠道"，统一归入第 4 组。

### 1. 账号（邮箱）+ 密码

- **注册**（两步：发码 → 验证码+密码+**必填昵称**建号，创建即 `ACTIVE` 且 `emailVerified=true`）
- **登录**（邮箱 + 密码，沿用现有 `LocalStrategy`）

### 2. 邮箱验证码

- **验证码登录**（邮箱 + 验证码，无需密码）
- **换绑邮箱**（双重验证：确认时同时校验旧邮箱验证码/登录密码 + 新邮箱验证码）

### 3. 手机号

- **绑定手机号**（已登录，手机验证码验证后绑定）
- **验证码登录**（手机号 + 验证码）
- **换绑手机号**（双重验证：确认时同时校验旧手机验证码/登录密码 + 新手机验证码）

### 4. 设置新密码（统一功能，三种身份验证渠道）

「修改密码」与「忘记/重置密码」本质是同一个功能——**设置一个新密码**，区别只在于用哪种方式验证身份：

- **渠道 A：账号(邮箱) + 旧密码 + 新密码**（已登录或未登录皆可，知道旧密码即可）
- **渠道 B：手机号 + 验证码 + 新密码**（无需旧密码）
- **渠道 C：邮箱 + 验证码 + 新密码**（无需旧密码）

---

## 三、整体架构

```
                        ┌─────────────────────────────┐
                        │        AuthController         │  各类登录/注册/绑定/密码 HTTP 入口
                        └───────────────┬──────────────┘
                                        │
                        ┌───────────────▼──────────────┐
                        │          AuthService          │  编排：校验身份 + 签发 token
                        └───┬───────────┬───────────┬───┘
                            │           │           │
              ┌─────────────▼──┐ ┌──────▼───────┐ ┌─▼────────────────┐
              │ VerificationSvc │ │ SessionSvc   │ │  UserService     │
              │ 验证码生成/校验  │ │ 会话/JWT     │ │  用户增改查      │
              └───────┬────────┘ └──────────────┘ └──────────────────┘
                      │ 存 Redis（带 scene 隔离 + TTL + 防重放）
                      │ 发送任务入队
              ┌───────▼─────────┐
              │  BullMQ Queue   │  notify 队列（mail / sms 两类 job）
              └───┬─────────┬───┘
                  │         │
          ┌───────▼──┐  ┌───▼────────┐
          │ MailSvc  │  │  SmsSvc    │  SmsProvider 抽象：mock / aliyun / tencent
          │ (SMTP)   │  └────────────┘
          └──────────┘
```

### 设计要点

- **验证码与发送解耦**：`VerificationService` 只负责"生成/存储/校验验证码"，发送动作作为 BullMQ job 投递，由 `MailProcessor` / `SmsProcessor` 消费。
- **验证码登录不走 Passport 策略**：`LocalStrategy` 保留给"邮箱+密码"。验证码登录、找回密码等在 `AuthService` 内直接校验，无需新增 Passport 策略（更轻量）。
- **BullMQ 使用独立 Redis 连接**：现有 `RedisService` 连接设了 `maxRetriesPerRequest: 1`，而 BullMQ 要求 `maxRetriesPerRequest: null`，因此队列单独建连接，不复用。
- **图形验证码前置**：所有"发送验证码"接口先经过 `CaptchaService` 校验 SVG 图形验证码，通过后才允许发送短信/邮件验证码，防止发码接口被脚本刷（也顺带缓解账号枚举）。
- **验证码 dev 派发**：
  - **邮件**：本地推荐起 MailDev（`deploy/maildev/docker-compose.yml`），SMTP 指向 `localhost:1025`，在 Web UI `http://localhost:1080` 查看验证码邮件；若未配置 `MAIL_HOST`/`MAIL_USER`/`MAIL_PASSWORD`，则回退为 logger 打印。
  - **短信**：`SMS_DRIVER=mock`，验证码打到控制台；生产不打印明文验证码。

---

## 四、数据模型变更

### 4.1 `User` 实体（`apps/back/src/user/entities/user.entity.ts`）

现有字段已基本够用（`email` / `phone` / `emailVerified` / `phoneVerified` / `status`），**无需新增列**。仅需在业务逻辑中：

- 注册成功后：`status = ACTIVE`、`emailVerified = true`
- 绑定/换绑手机成功：`phone = xxx`、`phoneVerified = true`
- 换绑邮箱成功：`email = xxx`、`emailVerified = true`

> `phone` 已是 `unique + nullable`，`email` 已是 `unique + nullable`，满足验证码登录按手机/邮箱查用户的需求。

### 4.2 验证码存储（Redis，不落库）

| 键                              | 值                            | TTL  | 用途                                     |
| ------------------------------- | ----------------------------- | ---- | ---------------------------------------- |
| `verify:code:{scene}:{target}`  | JSON `{ codeHash, attempts }` | 300s | 存验证码（哈希后存，防泄露）与错误次数   |
| `verify:lock:{scene}:{target}`  | `1`                           | 60s  | 发送频率锁（60s 内不可重复发）           |
| `verify:daily:{scene}:{target}` | 计数                          | 当天 | 单日发送上限（默认 10 次/天）            |
| `captcha:{captchaId}`           | 图形验证码文本（小写）        | 120s | SVG 图形验证码校验（一次性，校验后即删） |

- `scene`（场景枚举，**必须隔离**，防止验证码跨场景复用）：
  - `REGISTER` 注册
  - `LOGIN_EMAIL` / `LOGIN_PHONE` 验证码登录
  - `RESET_PWD_EMAIL` / `RESET_PWD_PHONE` 重置密码
  - `BIND_PHONE` 绑定手机
  - `REBIND_EMAIL_OLD` / `REBIND_EMAIL_NEW` 换绑邮箱（旧/新）
  - `REBIND_PHONE_OLD` / `REBIND_PHONE_NEW` 换绑手机（旧/新）
- `target`：邮箱地址或手机号。
- **防重放**：校验成功后立即 `DEL` 该 code 键。
- **防爆破**：`attempts` 超过上限（默认 5）即删除验证码，需重新发送。
- **强依赖 Redis**：验证码相关接口在 `REDIS_ENABLED=false` 时直接返回 503（不降级），避免安全绕过。

---

## 五、新增模块与目录

```
apps/back/src/
├── captcha/                      # 图形验证码（SVG）
│   ├── captcha.module.ts
│   ├── captcha.controller.ts     # GET /captcha 生成图形验证码
│   └── captcha.service.ts        # svg-captcha 生成 + Redis 校验
├── verification/                 # 验证码核心
│   ├── verification.module.ts
│   ├── verification.service.ts   # 生成/存储/校验/频率&次数限制
│   └── verification.constants.ts # scene 枚举、key 前缀、默认参数
├── mail/                         # 邮件（SMTP）
│   ├── mail.module.ts
│   ├── mail.service.ts           # sendVerificationCode(...) 等
│   └── templates/                # 验证码邮件模板
├── sms/                          # 短信（抽象 + 多实现）
│   ├── sms.module.ts
│   ├── sms.service.ts
│   ├── sms.provider.interface.ts # SmsProvider 接口
│   └── providers/
│       ├── mock-sms.provider.ts     # dev：控制台打印
│       ├── aliyun-sms.provider.ts   # 生产预留
│       └── tencent-sms.provider.ts  # 生产预留
├── queue/                        # BullMQ
│   ├── queue.module.ts           # 注册 notify 队列 + 独立 Redis 连接
│   └── processors/
│       ├── mail.processor.ts
│       └── sms.processor.ts
└── auth/                         # 扩展现有
    ├── auth.controller.ts        # 新增多个端点
    ├── auth.service.ts           # 新增多种校验/登录/重置逻辑
    └── dto/                      # 新增下述 DTO
```

---

## 六、API 端点设计

> 前缀均为 `/auth`（图形验证码除外）。除特别标注 🔒（需登录）外均为 `@Public()`。发码类端点统一加 `@Throttle`（更严格）。
>
> **所有"发送验证码（send-code）"端点入参都额外带图形验证码字段** `captchaId` + `captchaText`，服务端先校验图形验证码再发码；下表为简洁省略，统一见备注。

### 6.0 图形验证码

| 方法 | 路径       | 说明                                        | 返回                 |
| ---- | ---------- | ------------------------------------------- | -------------------- |
| GET  | `/captcha` | 生成一张 SVG 图形验证码，文本存 Redis(120s) | `{ captchaId, svg }` |

### 6.1 邮箱 + 密码

| 方法 | 路径                  | 说明                                              | 入参                                  |
| ---- | --------------------- | ------------------------------------------------- | ------------------------------------- |
| POST | `/register/send-code` | 发送注册验证码到邮箱（校验邮箱未被占用）          | `{ email, captchaId, captchaText }`   |
| POST | `/register`           | 校验验证码并建号（`ACTIVE`/`emailVerified=true`） | `{ email, code, password, nickname }` |
| POST | `/login`              | 邮箱+密码登录（现有）                             | `{ email, password }`                 |

### 6.2 邮箱验证码 / 换绑邮箱

| 方法    | 路径                          | 说明                                                                       | 入参                                         |
| ------- | ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| POST    | `/login/email/send-code`      | 发送登录验证码（校验邮箱已注册，未注册提示"未注册"）                       | `{ email, captchaId, captchaText }`          |
| POST    | `/login/email`                | 邮箱验证码登录                                                             | `{ email, code }`                            |
| 🔒 POST | `/email/rebind/send-old-code` | 向当前邮箱发验证码（验旧身份方式①，可选；用密码验旧时可跳过）              | `{ captchaId, captchaText }`                 |
| 🔒 POST | `/email/rebind/send-new-code` | 向新邮箱发验证码（校验新邮箱未占用）                                       | `{ newEmail, captchaId, captchaText }`       |
| 🔒 POST | `/email/rebind/confirm`       | 校验旧身份（旧邮箱验证码 **或** 登录密码，二选一）+ 新邮箱验证码，完成换绑 | `{ newEmail, newCode, oldCode?, password? }` |

### 6.3 手机号

| 方法    | 路径                          | 说明                                                                       | 入参                                         |
| ------- | ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| 🔒 POST | `/phone/bind/send-code`       | 向待绑定手机发验证码（校验手机未被占用）                                   | `{ phone, captchaId, captchaText }`          |
| 🔒 POST | `/phone/bind`                 | 校验验证码并绑定手机                                                       | `{ phone, code }`                            |
| POST    | `/login/phone/send-code`      | 发送登录验证码（校验手机已注册，未注册提示"未注册"）                       | `{ phone, captchaId, captchaText }`          |
| POST    | `/login/phone`                | 手机验证码登录                                                             | `{ phone, code }`                            |
| 🔒 POST | `/phone/rebind/send-old-code` | 向当前手机发验证码（验旧身份方式①，可选；用密码验旧时可跳过）              | `{ captchaId, captchaText }`                 |
| 🔒 POST | `/phone/rebind/send-new-code` | 向新手机发验证码（校验新手机未占用）                                       | `{ newPhone, captchaId, captchaText }`       |
| 🔒 POST | `/phone/rebind/confirm`       | 校验旧身份（旧手机验证码 **或** 登录密码，二选一）+ 新手机验证码，完成换绑 | `{ newPhone, newCode, oldCode?, password? }` |

### 6.4 设置新密码（统一功能，三渠道）

同一目标「设置新密码」，按身份验证渠道拆成三个端点（发码端点复用重置密码场景）：

| 方法 | 路径                              | 渠道 | 说明                       | 入参                                  |
| ---- | --------------------------------- | ---- | -------------------------- | ------------------------------------- |
| POST | `/password/reset/by-password`     | A    | 账号+旧密码 校验后设新密码 | `{ email, oldPassword, newPassword }` |
| POST | `/password/reset/phone/send-code` | B    | 发手机验证码               | `{ phone, captchaId, captchaText }`   |
| POST | `/password/reset/phone`           | B    | 手机验证码校验后设新密码   | `{ phone, code, newPassword }`        |
| POST | `/password/reset/email/send-code` | C    | 发邮箱验证码               | `{ email, captchaId, captchaText }`   |
| POST | `/password/reset/email`           | C    | 邮箱验证码校验后设新密码   | `{ email, code, newPassword }`        |

- 三个端点都是 `@Public()`：渠道 A 靠"旧密码"验证身份，渠道 B/C 靠"验证码"验证身份，均不依赖登录态（已登录用户携带 token 也可正常调用）。
- **重置成功后**：调用 `sessionService.invalidateAllForUser(userId)` 使该用户所有旧会话失效，强制用新密码重新登录（安全最佳实践）。

---

## 七、DTO 规划（`apps/back/src/auth/dto/`）

复用现有 `UserRegistrationFieldsDto` 的字段校验（`IsEmail` / `IsStrongPassword` / 手机 `Matches`）：

- `CaptchaFieldsDto`（基类，被各 send-code DTO 继承）`{ captchaId, captchaText }`
- `SendEmailCodeDto extends CaptchaFieldsDto` `{ email, captchaId, captchaText }`
- `SendPhoneCodeDto extends CaptchaFieldsDto` `{ phone, captchaId, captchaText }`
- `EmailPasswordRegisterDto`（改造）`{ email, code, password, nickname }` —— 增加 `code`，`nickname` 改为**必填**（`@IsNotEmpty()`）
- `EmailCodeLoginDto` `{ email, code }`
- `PhoneCodeLoginDto` `{ phone, code }`
- `BindPhoneDto` `{ phone, code }`
- `RebindEmailNewCodeDto extends CaptchaFieldsDto` `{ newEmail, captchaId, captchaText }`
- `RebindEmailConfirmDto` `{ newEmail, newCode, oldCode?, password? }` —— `oldCode` 与 `password` 二选一必填（自定义校验）
- `RebindPhoneNewCodeDto` / `RebindPhoneConfirmDto`（同上，手机版）
- `ResetPasswordByPasswordDto` `{ email, oldPassword, newPassword }`（渠道 A）
- `ResetPasswordByPhoneDto extends CaptchaFieldsDto` 的 send-code 版 + `{ phone, code, newPassword }` 提交版（渠道 B）
- `ResetPasswordByEmailDto`（同上，渠道 C）

- 验证码统一校验：`@IsString() @Length(6,6) @Matches(/^\d{6}$/)`。
- `nickname` 必填仅作用于注册 DTO：在 `EmailPasswordRegisterDto` 内用 `@IsNotEmpty()` 覆盖，不改动 `UserRegistrationFieldsDto`（其仍被后台"管理员建用户"复用，昵称保持可选）。
- 换绑"旧身份二选一"：落在 **confirm** DTO 上，用类级自定义校验器保证 `oldCode` 或 `password` 至少提供一个。

---

## 八、配置与环境变量

### 8.1 新增配置模块

- `config/mail/config.ts`（`mailConfigKey = 'mail'`）
- `config/sms/config.ts`（`smsConfigKey = 'sms'`）
- `config/verification/config.ts`（`verificationConfigKey = 'verification'`，含图形验证码参数）
- 在 `config.type.ts` 的 `AllConfigType` 与 `app.module.ts` 的 `load: [...]` 注册

### 8.2 `.env.example` 追加

```dotenv
# ── 邮件（SMTP）──
# 生产 / 真实邮箱示例：
MAIL_HOST=smtp.example.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=your@example.com
MAIL_PASSWORD=your-smtp-authcode
MAIL_FROM=your@example.com
MAIL_FROM_NAME=Full-Stack-Template

# 本地开发（MailDev）示例 —— 先启动：
#   docker compose -f deploy/maildev/docker-compose.yml up -d
# 然后改为：
# MAIL_HOST=localhost
# MAIL_PORT=1025
# MAIL_SECURE=false
# MAIL_USER=admin@example.com
# MAIL_PASSWORD=admin
# Web UI 看信：http://localhost:1080

# ── 短信 ──
# 驱动：mock（默认，dev 控制台打印）| aliyun | tencent
SMS_DRIVER=mock
# 生产预留（对应驱动才需要）
# SMS_ACCESS_KEY_ID=
# SMS_ACCESS_KEY_SECRET=
# SMS_SIGN_NAME=
# SMS_TEMPLATE_CODE=

# ── 验证码 ──
VERIFY_CODE_LENGTH=6
VERIFY_CODE_TTL_SECONDS=300
VERIFY_SEND_INTERVAL_SECONDS=60
VERIFY_MAX_ATTEMPTS=5
VERIFY_DAILY_LIMIT=10

# ── 图形验证码（SVG）──
CAPTCHA_LENGTH=4
CAPTCHA_TTL_SECONDS=120

# ── 队列（BullMQ，复用 Redis 连接参数）──
# 验证码功能依赖 Redis，需将 REDIS_ENABLED 设为 true
QUEUE_PREFIX=fst
```

> ⚠️ 启用验证码/队列后，`REDIS_ENABLED` 必须为 `true`。

### 8.3 本地邮件验证码（MailDev）

本地联调邮箱验证码时，不连真实 SMTP，改用 MailDev 捕获邮件：

1. 启动：`docker compose -f deploy/maildev/docker-compose.yml up -d`
2. `.env` 指向 MailDev：`MAIL_HOST=localhost`、`MAIL_PORT=1025`、`MAIL_SECURE=false`（用户名/密码可填任意占位，需非空以走真实 SMTP 发送路径）
3. 发码后在 Web UI [http://localhost:1080](http://localhost:1080) 查看验证码邮件
4. 若未配置 SMTP，`MailService` 会回退到 logger 打印验证码（不经过 MailDev）

---

## 九、依赖安装

```bash
pnpm --filter @full-stack-template-monorepo/back add nodemailer @nestjs/bullmq bullmq svg-captcha
pnpm --filter @full-stack-template-monorepo/back add -D @types/nodemailer
```

- `nodemailer`：真实 SMTP 发信
- `@nestjs/bullmq` + `bullmq`：队列（`bullmq` 内部自带 ioredis）
- `svg-captcha`：后端生成 SVG 图形验证码（无外部依赖）
- 阿里云/腾讯云 SDK 暂不装，等接真实短信时按需添加

---

## 十、安全与风控

1. **场景隔离**：验证码按 `scene` 存储，跨场景不可复用。
2. **发送频率**：同一 `target+scene` 60s 内仅可发一次（Redis lock）。
3. **单日上限**：默认 10 次/天/target。
4. **错误次数**：连续错误 5 次作废验证码。
5. **哈希存储**：验证码经哈希后存 Redis，日志脱敏（复用现有 `logger/redact.ts`）。
6. **图形验证码前置**：所有发码接口先校验 SVG 图形验证码（一次性，Redis 存 120s），挡住脚本批量刷码/探测。
7. **枚举取舍**：按需求，登录/换绑发码时若账号不存在直接提示"未注册"（体验优先）；批量枚举风险由第 6 条图形验证码 + 第 8 条限流兜底。
8. **会话失效**：改密/重置成功后使该用户全部会话失效。
9. **接口限流**：所有发码端点使用比登录更严格的 `@Throttle`（新增 `THROTTLE_LIMIT_SEND_CODE`）。
10. **换绑双验证**：确认换绑时同时证明"拥有旧渠道验证码 或 登录密码"与"拥有新渠道验证码"（旧身份校验在 confirm，不在 send-new-code）。

---

## 十一、实施阶段（建议逐步提交，每步可独立验证）

- [x] **阶段 0｜依赖与配置**：安装依赖，新增 mail/sms/verification 配置模块，补 `.env.example`。
- [x] **阶段 1｜验证码基座**：`CaptchaModule`（SVG 图形验证码）+ `VerificationService`（生成/存储/校验/风控）+ 单元测试。
- [x] **阶段 2｜发送通道**：`MailModule`(SMTP) + `SmsModule`(mock provider) + `QueueModule`(BullMQ) + 两个 processor；本地邮件用 MailDev，短信 mock 打控制台。
- [x] **阶段 3｜注册改造**：注册两步流程（`/register/send-code` 带图形验证码 + 改造 `/register`，昵称必填）。
- [x] **阶段 4｜验证码登录**：邮箱验证码登录 + 手机验证码登录。
- [x] **阶段 5｜设置新密码**：三渠道（旧密码 / 手机验证码 / 邮箱验证码）统一设新密码 + 成功后会话失效。
- [x] **阶段 6｜绑定与换绑**：绑定手机 + 换绑邮箱 + 换绑手机（双验证）。
- [x] **阶段 7｜收尾**：Swagger 文档、节流常量、e2e 冒烟、`docs` 补充使用说明。

> 端到端冒烟脚本：`apps/back/scripts/auth-smoke.mjs`（dev server 运行后 `node apps/back/scripts/auth-smoke.mjs`）。
> 原理：图形码文本从 Redis 读明文；短信/邮件验证码用 `JWT_SECRET` 复算 HMAC 写入 Redis，无需真实收发即可跑通全流程。

---

## 十二、已确认决策（原待确认项）

1. **验证码 dev 派发**：本地邮件走 MailDev（`deploy/maildev`，SMTP `1025` / UI `1080`）；未配 SMTP 时邮件回退 logger；短信 mock 打控制台。✅
2. **换绑旧身份验证**：**旧渠道验证码 或 登录密码 二选一都支持**，前端自选；校验时机在 **confirm**（与新渠道验证码一并校验）。✅
3. **注册昵称**：**必填**（仅注册 DTO 覆盖，后台建用户仍可选）。✅
4. **账号不存在处理**：登录/换绑等发码时即校验，不存在直接提示"未注册"，**不自动注册**。✅
5. **图形验证码前置**：采用**后端自生成 SVG 图形验证码**（`svg-captcha` + Redis），作为所有发码接口前置。✅

---

> 以上决策已并入正文并全部落地实现。
