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
