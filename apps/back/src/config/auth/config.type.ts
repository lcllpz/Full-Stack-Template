import { JwtSignOptions } from '@nestjs/jwt';

export type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

// 配置项的类型
export type AuthConfigType = {
  JWT_SECRET: string;
  JWT_EXPIRES_IN: JwtExpiresIn;

  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: JwtExpiresIn;
};
