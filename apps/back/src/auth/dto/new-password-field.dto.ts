import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsStrongPassword } from 'class-validator';

/** 新密码字段（强度规则与注册一致），供重置密码相关接口复用 */
export class NewPasswordFieldDto {
  @ApiProperty({ description: '新密码（至少8位，含大小写、数字、符号）' })
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  newPassword: string;
}
