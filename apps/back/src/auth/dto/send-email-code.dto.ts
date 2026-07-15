import { IntersectionType, PickType } from '@nestjs/swagger';

import { UserRegistrationFieldsDto } from '@/user/dto/user-registration-fields.dto';

import { CaptchaFieldsDto } from './captcha-fields.dto';

/** 发送邮箱验证码入参：邮箱 + 图形验证码 */
export class SendEmailCodeDto extends IntersectionType(
  PickType(UserRegistrationFieldsDto, ['email'] as const),
  CaptchaFieldsDto,
) {}
