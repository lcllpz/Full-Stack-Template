/** 图形验证码在 Redis 中的键前缀 */
export const CAPTCHA_KEY_PREFIX = 'captcha';

/** 构造图形验证码 Redis 键：captcha:{captchaId} */
export const captchaKey = (captchaId: string): string => `${CAPTCHA_KEY_PREFIX}:${captchaId}`;
