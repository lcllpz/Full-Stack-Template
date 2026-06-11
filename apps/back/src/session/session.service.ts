import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import { User } from '@/user/entities/user.entity';

import { Session } from './entities/session.entity';

@Injectable()
export class SessionService {
  @InjectRepository(Session)
  private readonly sessionRepository: Repository<Session>;

  /** 登录成功后创建会话，返回 sessionId + hash 供签发 JWT */
  async createForUser(userId: User['id']): Promise<Session> {
    const hash = randomBytes(32).toString('hex');
    return this.sessionRepository.save({ userId, hash });
  }

  async updateHash(sessionId: Session['id'], hash: Session['hash']): Promise<void> {
    await this.sessionRepository.update(sessionId, { hash });
  }

  /** 校验 session 是否仍有效（未软删除） */
  findValidById(id: string): Promise<Session | null> {
    return this.sessionRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { user: { roles: true } },
    });
  }

  /** 刷新 token 时：校验 session 存在且 hash 匹配 */
  async validateHash(sessionId: string, hash: string): Promise<Session | null> {
    const session = await this.findValidById(sessionId);
    if (!session || session.hash !== hash) {
      return null;
    }
    return session;
  }

  /** 单设备登出：软删除当前 session */
  async invalidate(sessionId: string): Promise<void> {
    await this.sessionRepository.softDelete(sessionId);
  }

  /** 全设备登出：使该用户所有 session 失效 */
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.sessionRepository.softDelete({ userId });
  }
}
