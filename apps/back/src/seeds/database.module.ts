import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { appConfigKey } from '@/config/app/config';
import { Environment } from '@/config/app/config.type';
import { authConfigKey } from '@/config/auth/config';
import { AllConfigType } from '@/config/config.type';
import { seedsConfigKey } from '@/config/seeds';

import { runSeeds } from '.';

/**
 * DatabaseModule
 *
 * 负责在应用启动后自动执行种子数据（幂等，重复执行安全）。
 *
 * 执行策略：
 *   - development / test：每次启动都执行（方便开发调试）
 *   - production：仅当环境变量 RUN_SEEDS=true 时执行
 *     （生产环境首次部署手动触发，防止意外覆盖数据）
 */
@Module({})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async onApplicationBootstrap() {
    const { nodeEnv } = this.configService.getOrThrow(appConfigKey, { infer: true });
    const seedsCfg = this.configService.getOrThrow(seedsConfigKey, { infer: true });
    const authCfg = this.configService.getOrThrow(authConfigKey, { infer: true });

    const shouldRun = nodeEnv !== Environment.Production || seedsCfg.RUN_SEEDS === true;

    if (!shouldRun) {
      this.logger.log('生产环境跳过种子数据（如需执行请设置 RUN_SEEDS=true）');
      return;
    }

    try {
      await runSeeds(this.dataSource, {
        ...seedsCfg,
        BCRYPT_SALT_ROUNDS: authCfg.BCRYPT_SALT_ROUNDS,
      });
    } catch (err) {
      this.logger.error('种子数据执行失败', err);
      // 种子失败不阻断服务启动，仅记录错误
    }
  }
}
