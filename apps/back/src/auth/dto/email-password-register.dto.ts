import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

/** 注册特有字段：昵称（必填）+ 邮箱验证码 */
class RegisterRequiredFieldsDto {
  /** 展示昵称，注册时必填 */
  @ApiProperty({ description: '昵称（必填）' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  nickname: string;

  /** 邮箱验证码（4~8 位数字，兼容不同 VERIFY_CODE_LENGTH 配置） */
  @ApiProperty({ description: '邮箱验证码' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  code: string;
}

/** 注册接口入参：邮箱 + 密码 + 昵称 + 邮箱验证码 */
export class EmailPasswordRegisterDto extends IntersectionType(
  PickType(UserRegistrationFieldsDto, ['email', 'password'] as const),
  RegisterRequiredFieldsDto,
) {}
