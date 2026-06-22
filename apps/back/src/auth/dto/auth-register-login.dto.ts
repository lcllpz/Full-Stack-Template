import { OmitType } from '@nestjs/swagger';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

/** 注册接口入参，字段与 CreateUserDto 一致 */
export class AuthRegisterLoginDto extends OmitType(UserRegistrationFieldsDto, [] as const) {}
