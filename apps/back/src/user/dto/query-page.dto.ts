import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryPageDto {
  /** 页码，从 1 开始 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 每页条数，最大 100 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pageSize?: number = 10;

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
