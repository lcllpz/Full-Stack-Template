import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

import { lowerCaseTransformer } from '@/utils/transformers/lower-case.transformer';

/** 用户注册 / 创建时共用的字段与校验规则 */
export class UserRegistrationFieldsDto {
  /** 展示昵称 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  /** 邮箱，可用于登录 / 找回密码 */
  @Transform(lowerCaseTransformer)
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(128)
  email: string;

  /** 登录密码，入库前需哈希 */
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  /** 手机号，可用于登录 / 短信验证 */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  /** 头像 URL */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsUrl()
  avatar?: string;
}
