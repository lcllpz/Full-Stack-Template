import { IntersectionType } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

import { UserRegistrationFieldsDto } from './user-registration-fields.dto';

class CreateUserRoleIdsDto {
  /** 绑定的角色 ID 列表 */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds?: string[];
}

export class CreateUserDto extends IntersectionType(
  UserRegistrationFieldsDto,
  CreateUserRoleIdsDto,
) {}
