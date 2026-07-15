import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { CaptchaFieldsDto } from './captcha-fields.dto';

/**
 * 换绑手机-第二步：校验旧身份后向新手机发码。
 * 旧身份二选一：oldCode（旧手机验证码）或 password（登录密码）。
 */
export class RebindPhoneNewCodeDto extends CaptchaFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  newPhone: string;
}

/** 换绑手机-第三步：校验新手机验证码并完成换绑 */
export class RebindPhoneConfirmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  newPhone: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  newCode: string;

  @ApiPropertyOptional({ description: '旧手机验证码（与 password 二选一）' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  oldCode?: string;

  @ApiPropertyOptional({ description: '登录密码（与 oldCode 二选一）' })
  @IsOptional()
  @IsString()
  password?: string;
}
