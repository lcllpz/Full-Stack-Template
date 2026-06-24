import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 触发 passport-local 流程，验证通过后写入 req.user */
// 扩展作用、直接将策略名（@UseGuards(AuthGuard('local'))）称传递给 AuthGuard() 会在代码库中引入魔法字符串
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
