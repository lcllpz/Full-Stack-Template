import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CreateRoleDto } from './dto/create-role.dto';
import { DeleteRoleDto } from './dto/delete-role.dto';
import { QueryRoleListDto } from './dto/query-role-list.dto';
import { QueryRolePageDto } from './dto/query-role-page.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleService } from './role.service';

@UseGuards(AuthGuard('jwt'))
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get('list')
  findAll(@Query() query: QueryRoleListDto) {
    return this.roleService.searchList(query);
  }

  @Get('page')
  findPage(@Query() query: QueryRolePageDto) {
    return this.roleService.searchPage(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete()
  remove(@Body() dto: DeleteRoleDto) {
    return this.roleService.remove(dto);
  }
}
