import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';

import { AUDIT_CLS_KEYS } from './audit.constants';

/**
 * 在 Guard 通过后、Controller 执行前，将当前操作人写入 CLS
 * （ip / userAgent 由 ClsModule middleware 提前写入）
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    console.log('AuditContextInterceptor 审计日志');

    const req = context.switchToHttp().getRequest<{ user?: { userId?: string } }>();
    if (req.user?.userId) {
      this.cls.set(AUDIT_CLS_KEYS.userId, req.user.userId);
    }
    return next.handle();
  }
}
