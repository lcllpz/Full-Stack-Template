import { PickType } from '@nestjs/swagger';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

/** 登录接口入参：邮箱 + 密码 */
export class AuthLoginDto extends PickType(UserRegistrationFieldsDto, [
  'email',
  'password',
] as const) {}
