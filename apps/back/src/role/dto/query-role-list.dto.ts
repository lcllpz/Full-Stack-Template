import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class QueryRoleListDto {
  /** 按 UUID 精确查询 */
  @IsOptional()
  @IsUUID()
  id?: string;

  /** 按角色名称模糊查询 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  /** 按是否系统角色筛选 */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isSystem?: boolean;
}
