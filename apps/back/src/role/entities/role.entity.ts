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

import { Menu } from '@/menu/entities/menu.entity';
import { User } from '@/user/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 角色名称，如「管理员」 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 角色描述 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /** 是否系统内置角色，内置角色一般不允许删除 */
  @Column({ default: false })
  isSystem: boolean;

  /** 拥有此角色的用户 */
  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  /**
   * 角色拥有的菜单/按钮权限
   * - DIRECTORY/MENU 类型：控制菜单可见性
   * - BUTTON 类型：同时作为接口级权限（PermissionsGuard 通过 menu.code 校验）
   */
  @ManyToMany(() => Menu, (menu) => menu.roles)
  @JoinTable({ name: 'role_menus' })
  menus: Menu[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
