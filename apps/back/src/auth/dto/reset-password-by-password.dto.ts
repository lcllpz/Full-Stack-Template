import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

import { NewPasswordFieldDto } from './new-password-field.dto';

/** 渠道A：账号(邮箱) + 旧密码 → 设新密码 */
export class ResetPasswordByPasswordDto extends IntersectionType(
  PickType(UserRegistrationFieldsDto, ['email'] as const),
  NewPasswordFieldDto,
) {
  @ApiProperty({ description: '旧密码' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;
}
