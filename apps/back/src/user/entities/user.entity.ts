import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Role } from '@/role/entities/role.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
  DELETED = 'deleted',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 邮箱，可用于登录 / 找回密码 /账号*/
  //unique：  通常设唯一索引
  // nullable：不必填时设置为null
  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  email: string;

  /** 手机号，可用于登录 / 短信验证 */
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone: string | null;

  /** 登录密码（哈希后存储，默认查询不返回） */
  @Exclude()
  @Column({ length: 255 })
  // 使用 class-transformer 的 Exclude 装饰器，排除密码字段
  // 在返回客户端用户信息时，不会返回密码字段
  password: string;

  /** 展示昵称 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  nickname: string | null;

  /** 头像 URL */
  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.INACTIVE })
  status: UserStatus;

  // 一般不需要加 cascade。User ↔ Role 这种 RBAC 多对多，角色通常是独立主数据，和用户是「关联已有记录」，不是「保存用户时顺带创建/删除角色」
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable()
  roles: Role[];

  /** 邮箱是否已验证 */
  @Column({ default: false })
  emailVerified: boolean;

  /** 手机号是否已验证 */
  @Column({ default: false })
  phoneVerified: boolean;

  /** 最近一次登录时间 */
  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** 软删除时间，null 表示未删除 */
  @DeleteDateColumn()
  deletedAt: Date | null;
}
