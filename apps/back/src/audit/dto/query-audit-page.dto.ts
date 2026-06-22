import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryAuditPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  /** 按操作人筛选 */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** 按操作类型筛选，如 user:delete */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  action?: string;

  /** 按资源模块筛选，如 user */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  resource?: string;

  /** 按资源 ID 筛选 */
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  /** 起始时间（ISO 8601） */
  @IsOptional()
  @IsDateString()
  startTime?: string;

  /** 结束时间（ISO 8601） */
  @IsOptional()
  @IsDateString()
  endTime?: string;
}
