export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// 配置项的类型
export type AppConfig = {
  nodeEnv: Environment;
  port: number;
  /** 非 production 默认 true，可通过 SWAGGER_ENABLED 覆盖 */
  swaggerEnabled: boolean;
  swaggerPath: string;
};
