import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 图形验证码字段基类。
 * 所有「发送验证码」类接口都需携带，服务端先校验图形验证码再发码（防刷 + 缓解枚举）。
 */
export class CaptchaFieldsDto {
  /** 图形验证码标识，来自 GET /captcha 返回的 captchaId */
  @ApiProperty({ description: '图形验证码 id（GET /captcha 返回）' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  captchaId: string;

  /** 用户识别图形验证码后输入的文本 */
  @ApiProperty({ description: '图形验证码文本' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  captchaText: string;
}
