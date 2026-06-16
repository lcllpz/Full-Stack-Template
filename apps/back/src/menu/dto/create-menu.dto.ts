import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { MenuType } from '../entities/menu.entity';

/**
 * 将 pid 归一化：
 *   0 / '0' / null / undefined / '' → null（顶层）
 *   其他字符串               → 原值（UUID）
 */
const normalizeParentId = ({ value }: { value: unknown }): string | null => {
  if (value === 0 || value === '0' || value === null || value === undefined || value === '') {
    return null;
  }
  return value as string;
};

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  title: string;

  @IsEnum(MenuType)
  @IsNotEmpty()
  type: MenuType;

  /**
   * 路由路径
   * - DIRECTORY / MENU：必填
   * - BUTTON：不需要（固定为 null）
   */
  @ValidateIf((o) => o.type !== MenuType.BUTTON)
  @IsString()
  @IsOptional()
  @MaxLength(255)
  path?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  icon?: string;

  /**
   * 权限码，仅 BUTTON 类型必填，格式：模块:操作，如 user:create
   */
  @ValidateIf((o) => o.type === MenuType.BUTTON)
  @IsNotEmpty({ message: 'BUTTON 类型必须填写权限码 code' })
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-z_]+:[a-z_]+$/, { message: '权限码格式应为 module:action，如 user:create' })
  code: string;

  /**
   * 父菜单 id
   * - DIRECTORY / MENU：传 0 或 null 表示顶层节点
   * - BUTTON：必须传入所属 MENU 节点的 id（按钮不能作为顶层节点）
   * 前端传 0 / '0' / null 均视为顶层
   */
  @Transform(normalizeParentId)
  @ValidateIf((o) => o.type === MenuType.BUTTON)
  @IsUUID('4', { message: 'BUTTON 类型必须指定父菜单 id（parentId）' })
  @ValidateIf((o) => o.type !== MenuType.BUTTON)
  @IsUUID('4')
  @IsOptional()
  parentId?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  sort?: number;

  /**
   * 是否在侧边栏中显示
   * BUTTON 类型固定为 false（按钮不出现在菜单栏）
   */
  @IsBoolean()
  @IsOptional()
  visible?: boolean;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
