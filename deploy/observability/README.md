# 本机可观测栈（Loki + Promtail + Grafana）

按正式项目常见做法：**应用写本地 JSON 文件 → Agent 采集 → Loki 存储 → Grafana 查询**。  
Nest 侧零侵入，不使用 `winston-loki` 直推。

```text
Nest Winston  →  apps/back/logs/*.log  →  Promtail  →  Loki  →  Grafana
```

| 环节                      | 作用                                                         |
| ------------------------- | ------------------------------------------------------------ |
| **Nest Winston**          | 应用写结构化 JSON 日志（含 `traceId`、脱敏），不负责远程推送 |
| **apps/back/logs/\*.log** | 本地落盘缓冲；采集故障不影响 Nest                            |
| **Promtail**              | 采集 Agent：tail 文件、解析 JSON、打标签，推送到 Loki        |
| **Loki**                  | 日志聚合存储（按标签索引），提供 LogQL 查询                  |
| **Grafana**               | 查询与可视化 UI，连接 Loki 做检索                            |

规划与选型说明见 [`docs/plan/日志方案规划.md`](../../docs/plan/日志方案规划.md) §7.1。

| 服务     | 地址                        | 说明                 |
| -------- | --------------------------- | -------------------- |
| Grafana  | http://localhost:3000       | 默认 `admin`/`admin` |
| Loki     | http://localhost:3100/ready | 就绪探针             |
| Promtail | （无对外端口，仅推 Loki）   | 读宿主机日志目录     |

## 前置条件

1. 已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（含 Compose）
2. 后端开启文件日志，例如在 `apps/back/.env`：

```env
LOG_FILE_ENABLED=true
LOG_DIR=logs
```

3. 至少跑过后端并产生过请求，使 `apps/back/logs/` 下出现 `app-*.log` / `error-*.log`

未开文件日志时 Promtail 无数据，属预期，不是 Loki 故障。

## 启动 / 停止

在**仓库根目录**执行：

```bash
# 后台启动 Loki / Promtail / Grafana 三个容器
docker compose -f deploy/observability/docker-compose.yml up -d

# 查看各服务运行状态（是否 Up、端口映射）
docker compose -f deploy/observability/docker-compose.yml ps

# 停止并移除本 compose 创建的容器（数据卷默认保留，日志历史不丢）
docker compose -f deploy/observability/docker-compose.yml down
```

查看 Promtail / Loki 日志：

```bash
docker compose -f deploy/observability/docker-compose.yml logs -f promtail
docker compose -f deploy/observability/docker-compose.yml logs -f loki
```

## 验收（Grafana Explore）

1. 打开 http://localhost:3000 ，登录 `admin` / `admin`
2. 左侧 **Explore** → 数据源选择 **Loki**
3. 常用 LogQL：

```logql
{job="back"}
```

```logql
{job="back"} |= "error"
```

```logql
{job="back"} | json | level="error"
```

```logql
{job="back"} | json | traceId="<某次请求的 x-request-id>"
```

标签说明：

- 静态：`job=back`、`app=full-stack-template`
- 从 JSON 提取：`level`、`service`（`traceId` 仅作日志字段，不当标签，避免高基数）

## 目录结构

```text
deploy/observability/
├── docker-compose.yml
├── README.md
├── loki/loki-config.yml
├── promtail/promtail-config.yml
└── grafana/provisioning/datasources/loki.yml
```

## 与规划文档的关系

对应 [`docs/plan/日志方案规划.md`](../../docs/plan/日志方案规划.md) **§7.1 本仓库落地：方案 A**。  
错误告警（Sentry 等）不在本目录范围内，可后续单独接入。
