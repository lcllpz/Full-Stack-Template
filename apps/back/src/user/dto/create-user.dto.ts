import { IsArray, IsOptional, IsUUID } from 'class-validator';

import { UserRegistrationFieldsDto } from './user-registration-fields.dto';

export class CreateUserDto extends UserRegistrationFieldsDto {
  /** 绑定的角色 ID 列表 */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds?: string[];
}
