/** 用户实体（对应 NestJS 后端返回结构，按实际接口调整） */
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

/** 列表查询参数（用 type 而非 interface，便于作为 request 的 params 传入） */
export type UserListQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
};

/** 创建用户入参 */
export interface CreateUserDto {
  name: string;
  email: string;
}

/** 更新用户入参 */
export type UpdateUserDto = Partial<CreateUserDto>;
