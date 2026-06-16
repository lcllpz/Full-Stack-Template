import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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

  /**
   * 绑定的菜单 id 列表（含目录/页面/按钮）
   * 后端会自动补全所有后代节点，无需前端递归传入子节点
   * 不传或传空数组 = 清空菜单绑定
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  menuIds?: string[];
}
