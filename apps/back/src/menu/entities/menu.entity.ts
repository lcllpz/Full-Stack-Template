import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Role } from '@/role/entities/role.entity';

export enum MenuType {
  DIRECTORY = 'directory', // 目录（无路由，只作为父节点）
  MENU = 'menu', // 菜单页面
  BUTTON = 'button', // 页面内按钮/操作
}

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  title: string;

  @Column({ type: 'enum', enum: MenuType, default: MenuType.MENU })
  type: MenuType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  icon: string | null;

  /**
   * 权限码，仅 BUTTON 类型必填，格式：模块:操作，如 user:create
   * - DIRECTORY / MENU：通常为 null，角色直接关联菜单节点
   * - BUTTON：必填，PermissionsGuard 通过此码校验接口访问权限
   */
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  code: string | null;

  /** 父菜单 id，顶层菜单为 null */
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ default: true })
  visible: boolean;

  /** 系统内置，不允许删除 */
  @Column({ default: false })
  isSystem: boolean;

  /** 拥有此菜单/按钮的角色 */
  @ManyToMany(() => Role, (role) => role.menus)
  roles: Role[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
