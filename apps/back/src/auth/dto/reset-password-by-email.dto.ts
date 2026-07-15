import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

import { NewPasswordFieldDto } from './new-password-field.dto';

/** 渠道C：邮箱 + 验证码 → 设新密码 */
export class ResetPasswordByEmailDto extends IntersectionType(
  PickType(UserRegistrationFieldsDto, ['email'] as const),
  NewPasswordFieldDto,
) {
  @ApiProperty({ description: '邮箱验证码' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  code: string;
}
