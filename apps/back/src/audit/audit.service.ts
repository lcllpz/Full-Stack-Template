import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';

import { QueryAuditPageDto } from './dto/query-audit-page.dto';
import { AuditLog } from './entities/audit-log.entity';
import { AUDIT_CLS_KEYS } from './audit.constants';

export interface AuditLogInput {
  action: string;
  resourceId?: string | null;
  detail?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly cls: ClsService,
  ) {}

  /**
   * 异步写入审计日志（不阻塞主业务流程）
   * 未登录请求（无 userId）时跳过
   * log() 返回 void，不是 async  调用方不用也不应该 await：
   */
  log(input: AuditLogInput): void {
    const userId = this.cls.get<string>(AUDIT_CLS_KEYS.userId);
    if (!userId) return;

    const resource = input.action.split(':')[0] ?? 'unknown';
    const entry = this.auditLogRepository.create({
      userId,
      action: input.action,
      resource,
      resourceId: input.resourceId ?? null,
      detail: input.detail ?? null,
      ip: this.cls.get<string>(AUDIT_CLS_KEYS.ip) ?? null,
      userAgent: this.cls.get<string>(AUDIT_CLS_KEYS.userAgent) ?? null,
    });

    void this.auditLogRepository.save(entry).catch((err: unknown) => {
      console.error('[AuditLog] 写入失败:', err);
    });
  }

  async searchPage(query: QueryAuditPageDto) {
    const {
      page = 1,
      pageSize = 10,
      userId,
      action,
      resource,
      resourceId,
      startTime,
      endTime,
    } = query;

    const qb = this.auditLogRepository.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (userId) qb.andWhere('log.userId = :userId', { userId });
    if (action) qb.andWhere('log.action = :action', { action });
    if (resource) qb.andWhere('log.resource = :resource', { resource });
    if (resourceId) qb.andWhere('log.resourceId = :resourceId', { resourceId });
    if (startTime) qb.andWhere('log.createdAt >= :startTime', { startTime });
    if (endTime) qb.andWhere('log.createdAt <= :endTime', { endTime });

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data: list, total, page, pageSize, totalPage: Math.ceil(total / pageSize) };
  }
}

/** 剔除敏感字段，供 detail 快照使用 */
export function sanitizeAuditSnapshot<T extends Record<string, unknown>>(
  data: T,
): Omit<T, 'password'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...rest } = data;
  return rest;
}
