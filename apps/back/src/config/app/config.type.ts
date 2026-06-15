export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// 配置项的类型
export type AppConfig = {
  nodeEnv: Environment;
  port: number;
};
