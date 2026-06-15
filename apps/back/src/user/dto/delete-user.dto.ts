import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class DeleteUserDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids: string[];
}
