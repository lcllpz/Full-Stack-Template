import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class QueryUserListDto {
  /** 按 UUID 精确查询 */
  @IsOptional()
  @IsUUID()
  id?: string;

  /** 按昵称模糊查询 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  /** 按邮箱模糊查询 */
  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: string;

  /** 按手机号模糊查询 */
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  /** 按角色标识筛选（如 admin / user） */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  roleCode?: string[];
}
