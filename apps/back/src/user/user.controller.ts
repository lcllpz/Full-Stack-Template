import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@/permission/permission.constants';
import { Permissions } from '@/permission/permissions.decorator';

import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { QueryPageDto } from './dto/query-page.dto';
import { QueryUserListDto } from './dto/query-user-list.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiTags('用户')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions(PERMISSIONS.USER_CREATE)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get('list')
  @Permissions(PERMISSIONS.USER_READ)
  findAll(@Query() query: QueryUserListDto) {
    return this.userService.searchList(query);
  }

  @Get('page')
  @Permissions(PERMISSIONS.USER_READ)
  findPage(@Query() query: QueryPageDto) {
    return this.userService.searchPage(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USER_READ)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete()
  @Permissions(PERMISSIONS.USER_DELETE)
  remove(@Body() dto: DeleteUserDto) {
    return this.userService.remove(dto.ids);
  }
}
