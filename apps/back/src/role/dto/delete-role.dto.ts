import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class DeleteRoleDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids?: string[];
}
