import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

/** 邮箱验证码登录入参：邮箱 + 验证码 */
export class EmailCodeLoginDto extends PickType(UserRegistrationFieldsDto, ['email'] as const) {
  /** 邮箱验证码（4~8 位数字） */
  @ApiProperty({ description: '邮箱验证码' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  code: string;
}
