import { IntersectionType } from '@nestjs/swagger';

import { CaptchaFieldsDto } from './captcha-fields.dto';
import { PhoneFieldDto } from './phone-field.dto';

/** 发送手机验证码入参：手机号 + 图形验证码 */
export class SendPhoneCodeDto extends IntersectionType(PhoneFieldDto, CaptchaFieldsDto) {}
