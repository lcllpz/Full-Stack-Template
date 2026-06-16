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

import { PERMISSIONS } from '@/permission/permission.constants';
import { Permissions } from '@/permission/permissions.decorator';
import { PermissionsGuard } from '@/permission/permissions.guard';

import { CreateRoleDto } from './dto/create-role.dto';
import { DeleteRoleDto } from './dto/delete-role.dto';
import { QueryRoleListDto } from './dto/query-role-list.dto';
import { QueryRolePageDto } from './dto/query-role-page.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleService } from './role.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * 创建角色（可同时绑定菜单）
   * Body 中传入 menuIds，后端自动级联补全后代节点
   */
  @Post()
  @Permissions(PERMISSIONS.ROLE_CREATE)
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get('list')
  @Permissions(PERMISSIONS.ROLE_READ)
  findAll(@Query() query: QueryRoleListDto) {
    return this.roleService.searchList(query);
  }

  @Get('page')
  @Permissions(PERMISSIONS.ROLE_READ)
  findPage(@Query() query: QueryRolePageDto) {
    return this.roleService.searchPage(query);
  }

  /**
   * 查询单个角色（含已绑定的菜单列表）
   * 用于进入编辑页时回显已选菜单
   */
  @Get(':id')
  @Permissions(PERMISSIONS.ROLE_READ)
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  /**
   * 编辑角色（可同时更新绑定菜单）
   * 传 menuIds → 更新菜单绑定；不传 menuIds → 保持原菜单不变
   */
  @Patch(':id')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete()
  @Permissions(PERMISSIONS.ROLE_DELETE)
  remove(@Body() dto: DeleteRoleDto) {
    return this.roleService.remove(dto);
  }
}
