import { PickType } from '@nestjs/swagger';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

/** 注册接口入参，字段与 CreateUserDto 一致 */
export class EmailPasswordLoginDto extends PickType(UserRegistrationFieldsDto, [
  'email',
  'password',
] as const) {}
