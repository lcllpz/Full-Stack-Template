/** 短信驱动：mock 仅在控制台打印验证码（dev）；aliyun/tencent 为生产真实短信（暂预留） */
export enum SmsDriver {
  Mock = 'mock',
  Aliyun = 'aliyun',
  Tencent = 'tencent',
}

export type SmsConfigType = {
  /** 当前生效的短信驱动 */
  SMS_DRIVER: SmsDriver;
  /** 云厂商 AccessKey ID（aliyun/tencent 驱动才需要） */
  SMS_ACCESS_KEY_ID?: string;
  /** 云厂商 AccessKey Secret */
  SMS_ACCESS_KEY_SECRET?: string;
  /** 短信签名，如「XX科技」 */
  SMS_SIGN_NAME?: string;
  /** 短信模板 ID/CODE */
  SMS_TEMPLATE_CODE?: string;
};
