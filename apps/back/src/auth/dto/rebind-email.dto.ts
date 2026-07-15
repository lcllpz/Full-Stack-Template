import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { lowerCaseTransformer } from '@/utils/transformers/lower-case.transformer';

import { CaptchaFieldsDto } from './captcha-fields.dto';

/**
 * 换绑邮箱-第二步：校验旧身份后向新邮箱发码。
 * 旧身份二选一：oldCode（旧邮箱验证码）或 password（登录密码），至少提供一个。
 */
export class RebindEmailNewCodeDto extends CaptchaFieldsDto {
  /** 新邮箱 */
  @Transform(lowerCaseTransformer)
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(128)
  newEmail: string;
}

/** 换绑邮箱-第三步：校验新邮箱验证码并完成换绑 */
export class RebindEmailConfirmDto {
  @Transform(lowerCaseTransformer)
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(128)
  newEmail: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  newCode: string;

  @ApiPropertyOptional({ description: '旧邮箱验证码（与 password 二选一）' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/, { message: '验证码格式不正确' })
  oldCode?: string;

  @ApiPropertyOptional({ description: '登录密码（与 oldCode 二选一）' })
  @IsOptional()
  @IsString()
  password?: string;
}
