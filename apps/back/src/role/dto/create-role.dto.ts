import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  /** 角色名称 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;

  /** 角色描述 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** 是否系统内置角色 */
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
