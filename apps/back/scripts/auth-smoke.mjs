// @ts-check
/**
 * 认证功能端到端冒烟测试脚本（开发环境专用）
 *
 * 覆盖：注册 → 密码登录 → 绑定手机 → 换绑邮箱(旧验证码方式) → 换绑手机(旧密码方式)
 *       → 重置密码 A(旧密码) / C(邮箱码) / B(手机码) → 用新密码登录。
 *
 * 原理：验证码在 Redis 中是 HMAC 哈希、不可逆；图形码文本是明文。
 *   - 图形码：调用 GET /captcha 拿 captchaId 后，直接从 Redis 读取明文文本回填。
 *   - 短信/邮件验证码：用 .env 的 JWT_SECRET 复算同样的 HMAC，把「已知验证码」写入
 *     Redis 对应键，从而在不读日志、不接真实邮件/短信的情况下完成校验。
 *
 * 前置条件：dev server 已在 http://localhost:4000 运行，且 Redis 可连。
 * 运行：node apps/back/scripts/auth-smoke.mjs
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Redis from 'ioredis';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 读取 apps/back/.env（仅取脚本需要的少量键，找不到则用默认值）──────────
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
    }
  } catch {
    // 忽略：无 .env 时用默认值
  }
  return env;
}

const fileEnv = loadEnv();
const cfg = {
  baseUrl: process.env.SMOKE_BASE_URL || `http://localhost:${fileEnv.PORT || 4000}`,
  jwtSecret: process.env.JWT_SECRET || fileEnv.JWT_SECRET || 'your-secret-key',
  redis: {
    host: fileEnv.REDIS_HOST || 'localhost',
    port: Number(fileEnv.REDIS_PORT || 6379),
    password: fileEnv.REDIS_PASSWORD || undefined,
    db: Number(fileEnv.REDIS_DB || 0),
  },
};

const redis = new Redis(cfg.redis);

// ── Redis 键构造（与后端保持一致）───────────────────────────────────────
const captchaKey = (id) => `captcha:${id}`;
const codeKey = (scene, target) => `verify:code:${scene}:${target}`;
const lockKey = (scene, target) => `verify:lock:${scene}:${target}`;

const KNOWN_CODE = '123456';

/** 复算后端 HMAC：createHmac(sha256, JWT_SECRET).update(`${scene}:${target}:${code}`) */
function hashCode(code, scene, target) {
  return createHmac('sha256', cfg.jwtSecret).update(`${scene}:${target}:${code}`).digest('hex');
}

/** 把已知验证码写入 Redis，覆盖后端真实下发的那条，便于自动化校验 */
async function injectCode(scene, target, code = KNOWN_CODE) {
  const payload = JSON.stringify({ codeHash: hashCode(code, scene, target), attempts: 0 });
  await redis.set(codeKey(scene, target), payload, 'EX', 300);
  // 清掉发送频率锁，避免同场景连续操作被限流
  await redis.del(lockKey(scene, target));
}

// ── HTTP 帮助函数 ─────────────────────────────────────────────────────────
async function http(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 无 body
  }
  return { status: res.status, ok: res.ok, json };
}
const post = (path, body, token) => http('POST', path, body, token);
const get = (path, token) => http('GET', path, token);

/** 调 /captcha 拿 id，并直接从 Redis 读明文文本回填 */
async function freshCaptcha() {
  const res = await get('/captcha');
  const captchaId = res.json?.data?.captchaId;
  if (!captchaId) throw new Error(`获取图形验证码失败: ${JSON.stringify(res.json)}`);
  const captchaText = await redis.get(captchaKey(captchaId));
  if (!captchaText) throw new Error('从 Redis 读取图形码文本失败');
  return { captchaId, captchaText };
}

// ── 断言与统计 ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` → ${detail}` : ''}`);
  }
}

async function main() {
  const ts = Date.now();
  const email = `smoke_${ts}@example.com`;
  const newEmail = `smoke_${ts}_new@example.com`;
  const phone = `139${String(ts).slice(-8)}`;
  const newPhone = `138${String(ts).slice(-8)}`;
  const nickname = `smoke_${ts}`;
  const pwd0 = 'Passw0rd!0';
  const pwd1 = 'Passw0rd!1';
  const pwd2 = 'Passw0rd!2';
  const pwd3 = 'Passw0rd!3';

  console.log(`\n认证冒烟测试 @ ${cfg.baseUrl}`);
  console.log(`  email=${email} phone=${phone}\n`);

  // 连通性检查
  await redis.ping().catch((e) => {
    throw new Error(`Redis 连接失败(${cfg.redis.host}:${cfg.redis.port}): ${e.message}`);
  });

  // ── 阶段1：注册 ──────────────────────────────────────────
  console.log('阶段1｜注册');
  {
    const cap = await freshCaptcha();
    const send = await post('/auth/register/send-code', { email, ...cap });
    check('注册-发码', send.ok, `status=${send.status} ${JSON.stringify(send.json)}`);

    await injectCode('register', email);
    const reg = await post('/auth/register', { email, password: pwd0, nickname, code: KNOWN_CODE });
    check('注册-提交', reg.ok, `status=${reg.status} ${JSON.stringify(reg.json)}`);
  }

  // ── 阶段2：密码登录，拿 token ─────────────────────────────
  console.log('阶段2｜密码登录');
  let token;
  {
    const login = await post('/auth/login', { email, password: pwd0 });
    token = login.json?.data?.token;
    check('密码登录', login.ok && Boolean(token), `status=${login.status} ${JSON.stringify(login.json)}`);
  }

  // ── 阶段6a：绑定手机 ─────────────────────────────────────
  console.log('阶段6a｜绑定手机');
  {
    const cap = await freshCaptcha();
    const send = await post('/auth/phone/bind/send-code', { phone, ...cap }, token);
    check('绑定手机-发码', send.ok, `status=${send.status} ${JSON.stringify(send.json)}`);

    await injectCode('bind_phone', phone);
    const bind = await post('/auth/phone/bind', { phone, code: KNOWN_CODE }, token);
    check('绑定手机-提交', bind.ok, `status=${bind.status} ${JSON.stringify(bind.json)}`);
  }

  // ── 阶段6b：换绑邮箱（旧身份用「旧邮箱验证码」）──────────────
  console.log('阶段6b｜换绑邮箱（旧验证码方式）');
  {
    const cap1 = await freshCaptcha();
    const old = await post('/auth/email/rebind/send-old-code', { ...cap1 }, token);
    check('换绑邮箱-原邮箱发码', old.ok, `status=${old.status} ${JSON.stringify(old.json)}`);

    // 注入「旧邮箱」验证码，供 send-new-code 校验旧身份
    await injectCode('rebind_email_old', email);
    const cap2 = await freshCaptcha();
    const newCodeReq = await post(
      '/auth/email/rebind/send-new-code',
      { newEmail, oldCode: KNOWN_CODE, ...cap2 },
      token,
    );
    check('换绑邮箱-验旧身份并向新邮箱发码', newCodeReq.ok, `status=${newCodeReq.status} ${JSON.stringify(newCodeReq.json)}`);

    await injectCode('rebind_email_new', newEmail);
    const confirm = await post('/auth/email/rebind/confirm', { newEmail, newCode: KNOWN_CODE }, token);
    check('换绑邮箱-确认', confirm.ok, `status=${confirm.status} ${JSON.stringify(confirm.json)}`);
  }

  // ── 阶段6c：换绑手机（旧身份用「登录密码」）────────────────
  console.log('阶段6c｜换绑手机（旧密码方式）');
  {
    const cap = await freshCaptcha();
    const newCodeReq = await post(
      '/auth/phone/rebind/send-new-code',
      { newPhone, password: pwd0, ...cap },
      token,
    );
    check('换绑手机-验密码并向新手机发码', newCodeReq.ok, `status=${newCodeReq.status} ${JSON.stringify(newCodeReq.json)}`);

    await injectCode('rebind_phone_new', newPhone);
    const confirm = await post('/auth/phone/rebind/confirm', { newPhone, newCode: KNOWN_CODE }, token);
    check('换绑手机-确认', confirm.ok, `status=${confirm.status} ${JSON.stringify(confirm.json)}`);
  }

  // 此时账号身份：email=newEmail，phone=newPhone，密码=pwd0

  // ── 阶段5A：重置密码（账号+旧密码）─────────────────────────
  console.log('阶段5A｜重置密码-旧密码方式');
  {
    const res = await post('/auth/password/reset/by-password', {
      email: newEmail,
      oldPassword: pwd0,
      newPassword: pwd1,
    });
    check('旧密码改密', res.ok, `status=${res.status} ${JSON.stringify(res.json)}`);
    const login = await post('/auth/login', { email: newEmail, password: pwd1 });
    check('用新密码(pwd1)登录', login.ok, `status=${login.status} ${JSON.stringify(login.json)}`);
  }

  // ── 阶段5C：重置密码（邮箱验证码）─────────────────────────
  console.log('阶段5C｜重置密码-邮箱验证码方式');
  {
    const cap = await freshCaptcha();
    const send = await post('/auth/password/reset/email/send-code', { email: newEmail, ...cap });
    check('邮箱改密-发码', send.ok, `status=${send.status} ${JSON.stringify(send.json)}`);

    await injectCode('reset_pwd_email', newEmail);
    const res = await post('/auth/password/reset/email', { email: newEmail, code: KNOWN_CODE, newPassword: pwd2 });
    check('邮箱改密-提交', res.ok, `status=${res.status} ${JSON.stringify(res.json)}`);
    const login = await post('/auth/login', { email: newEmail, password: pwd2 });
    check('用新密码(pwd2)登录', login.ok, `status=${login.status} ${JSON.stringify(login.json)}`);
  }

  // ── 阶段5B：重置密码（手机验证码）─────────────────────────
  console.log('阶段5B｜重置密码-手机验证码方式');
  {
    const cap = await freshCaptcha();
    const send = await post('/auth/password/reset/phone/send-code', { phone: newPhone, ...cap });
    check('手机改密-发码', send.ok, `status=${send.status} ${JSON.stringify(send.json)}`);

    await injectCode('reset_pwd_phone', newPhone);
    const res = await post('/auth/password/reset/phone', { phone: newPhone, code: KNOWN_CODE, newPassword: pwd3 });
    check('手机改密-提交', res.ok, `status=${res.status} ${JSON.stringify(res.json)}`);
    const login = await post('/auth/login', { email: newEmail, password: pwd3 });
    check('用新密码(pwd3)登录', login.ok, `status=${login.status} ${JSON.stringify(login.json)}`);
  }

  console.log(`\n结果：\x1b[32m${passed} 通过\x1b[0m，${failed ? `\x1b[31m${failed} 失败\x1b[0m` : '0 失败'}\n`);
}

main()
  .catch((e) => {
    console.error(`\n\x1b[31m脚本异常：\x1b[0m ${e.stack || e.message}`);
    failed++;
  })
  .finally(async () => {
    await redis.quit();
    process.exit(failed ? 1 : 0);
  });
