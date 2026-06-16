import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

import { Role } from '@/role/entities/role.entity';
import { User, UserStatus } from '@/user/entities/user.entity';

import { SeedsRunConfig } from '..';

/**
 * 系统账号种子（依赖 role.seed 先执行）
 *
 * 账号信息由调用方（DatabaseModule）通过 ConfigService 注入后传入，
 * 本函数不直接读取 process.env。
 *
 * ⚠️ 生产环境首次部署后请立即通过环境变量替换默认密码！
 */
export async function seedAdmin(dataSource: DataSource, config: SeedsRunConfig): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);

  const {
    SUPER_ADMIN_EMAIL: email,
    SUPER_ADMIN_PASSWORD: rawPassword,
    SUPER_ADMIN_ROLE_NAME,
    BCRYPT_SALT_ROUNDS,
  } = config;

  const superAdminRole = await roleRepo.findOne({ where: { name: SUPER_ADMIN_ROLE_NAME } });
  if (!superAdminRole) {
    throw new Error(`${SUPER_ADMIN_ROLE_NAME} 角色不存在，请先执行 role.seed`);
  }

  const existing = await userRepo.findOne({
    where: { email },
    withDeleted: true,
    relations: { roles: true },
  });

  if (existing) {
    // 已存在：恢复软删除并确保角色绑定正确
    if (existing.deletedAt) {
      await userRepo.recover(existing);
    }
    existing.roles = [superAdminRole];
    existing.status = UserStatus.ACTIVE;
    await userRepo.save(existing);
    console.log(`✅ 系统账号已存在并更新：${email}`);
    return;
  }

  // 首次创建
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  const password = await bcrypt.hash(rawPassword, salt);

  await userRepo.save(
    userRepo.create({
      email,
      password,
      nickname: '超级管理员',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      roles: [superAdminRole],
    }),
  );

  console.log(`✅ 系统账号创建完成：${email}`);
  console.log('⚠️  生产环境请通过 SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD 环境变量覆盖默认密码！');
}
