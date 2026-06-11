import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 角色名称，如「管理员」 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 角色标识，如 admin / user，代码里用，唯一 */
  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  /** 角色描述 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /** 是否系统内置角色，内置角色一般不允许删除 */
  @Column({ default: false })
  isSystem: boolean;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
