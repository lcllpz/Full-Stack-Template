import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** 手机号必填字段（与用户实体校验规则一致），供手机相关接口复用 */
export class PhoneFieldDto {
  @ApiProperty({ description: '手机号' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;
}
