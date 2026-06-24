nestjs cli:
nest -h
nest g res role

mysql数据库连接、sql：pnpm add --save @nestjs/typeorm typeorm mysql2
dto验证：pnpm add --save class-validator class-transformer
Passport是最流行的 Node.js 身份验证库
pnpm add --save @nestjs/passport passport passport-local
pnpm add --save-dev @types/passport-local
加盐哈希、密码比对:
pnpm add bcryptjs
pnpm add -D @types/bcryptjs

jwt
pnpm add @nestjs/jwt passport-jwt
pnpm add -D @types/passport-jwt

环境变量配置
pnpm add --save @nestjs/config

占用端口
netstat -ano | findstr :4000
taskkill /PID <上面看到的PID> /F

限流
@nestjs/throttler
@nest-lab/throttler-storage-redis

日志（Winston，纯 winston，无 nest-winston）：
pnpm add winston

环境变量（apps/back/.env）：
LOG_LEVEL=debug # error | warn | info | http | verbose | debug | silly
LOG_FILE_ENABLED=false # production 默认 true
LOG_DIR=logs # 启用文件时写入 error.log / combined.log 等

用法：

1. 业务代码继续 new Logger(XxxService.name)，已自动走 Winston
2. 直接注入 Winston：@Inject(WINSTON_LOGGER) private readonly logger: Logger

相关代码：apps/back/src/logger/
