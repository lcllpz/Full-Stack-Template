import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { NewPasswordFieldDto } from './new-password-field.dto';
import { PhoneFieldDto } from './phone-field.dto';

/** 渠道B：手机号 + 验证码 → 设新密码 */
export class ResetPasswordByPhoneDto extends IntersectionType(PhoneFieldDto, NewPasswordFieldDto) {
  @ApiProperty({ description: '手机验证码' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  code: string;
}
