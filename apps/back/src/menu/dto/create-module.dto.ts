import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** 标准 CRUD 动作 */
export const STANDARD_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type StandardAction = (typeof STANDARD_ACTIONS)[number];

/** 动作对应的中文显示名称 */
export const ACTION_LABELS: Record<StandardAction, string> = {
  read: '查看',
  create: '新建',
  update: '编辑',
  delete: '删除',
};

export class CreateModuleDto {
  /**
   * 模块标识，用于自动生成权限码前缀
   * 如 'user' → 生成 user:read / user:create / user:update / user:delete
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z_]+$/, { message: '模块名只能包含小写字母和下划线' })
  module: string;

  /** 菜单显示名称，如「用户管理」 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  title: string;

  /** 路由路径，如 /users */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  path: string;

  /** 图标名称 */
  @IsString()
  @IsOptional()
  @MaxLength(128)
  icon?: string;

  /** 父菜单 id（通常是所属目录的 id） */
  @IsUUID()
  @IsOptional()
  parentId?: string;

  /** 同级排序值 */
  @IsInt()
  @Min(0)
  @IsOptional()
  sort?: number;

  /**
   * 要生成的操作按钮，默认生成全部 CRUD 四个
   * 可按需精简，如只需 ['read', 'create']
   */
  @IsArray()
  @ArrayMinSize(1)
  @IsOptional()
  actions?: StandardAction[];

  /** 是否系统内置，不允许删除 */
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
