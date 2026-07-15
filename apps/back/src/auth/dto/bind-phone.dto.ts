import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { PhoneFieldDto } from './phone-field.dto';

/** 绑定手机：手机号 + 验证码 */
export class BindPhoneDto extends PhoneFieldDto {
  @ApiProperty({ description: '手机验证码' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  code: string;
}
