import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 操作审计日志（只插入，不更新、不软删除）
 * 建议在数据库层面对应用账号仅授予 INSERT + SELECT 权限
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 操作人 id */
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  /** 权限码格式，如 user:delete */
  @Column({ type: 'varchar', length: 128 })
  action: string;

  /** 资源模块，如 user / role / menu */
  @Column({ type: 'varchar', length: 64 })
  resource: string;

  /** 被操作的资源 ID，批量操作时可留空并在 detail 中记录 ids */
  @Column({ type: 'varchar', length: 36, nullable: true })
  resourceId: string | null;

  /** 操作前后数据快照（JSON） */
  @Column({ type: 'json', nullable: true })
  detail: Record<string, unknown> | null;

  /** 来源 IP */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  /** 浏览器 / 客户端信息 */
  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
