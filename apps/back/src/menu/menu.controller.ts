import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@/permission/permission.constants';
import { Permissions } from '@/permission/permissions.decorator';
import { PermissionsGuard } from '@/permission/permissions.guard';
import { SWAGGER_BEARER_AUTH } from '@/swagger/swagger.constants';

import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuService } from './menu.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@ApiTags('菜单')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ─── 单条创建 ──────────────────────────────────────────────

  /** 创建单个菜单项（目录/页面/按钮） */
  @Post()
  @Permissions(PERMISSIONS.MENU_CREATE)
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.create(dto);
  }

  // ─── 一键生成模块菜单树 ────────────────────────────────────

  /**
   * 一键生成标准模块菜单树
   * 传入 module + title + path，自动生成 MENU 节点 + BUTTON 子节点
   *
   * POST /menu/module
   * Body: { module: 'user', title: '用户管理', path: '/users', parentId?: '...' }
   * 自动生成：用户管理（MENU）+ 查看/新建/编辑/删除（4个BUTTON）
   */
  @Post('module')
  @Permissions(PERMISSIONS.MENU_CREATE)
  createModule(@Body() dto: CreateModuleDto) {
    return this.menuService.createModule(dto);
  }

  // ─── 查询 ──────────────────────────────────────────────────

  /** 获取完整菜单树（管理端，含 BUTTON 节点） */
  @Get('tree')
  @Permissions(PERMISSIONS.MENU_READ)
  findTree() {
    return this.menuService.findTree();
  }

  /** 获取平铺菜单列表 */
  @Get('list')
  @Permissions(PERMISSIONS.MENU_READ)
  findAll() {
    return this.menuService.findAll();
  }

  /** 获取单个菜单项 */
  @Get(':id')
  @Permissions(PERMISSIONS.MENU_READ)
  findOne(@Param('id') id: string) {
    return this.menuService.findOne(id);
  }

  // ─── 修改 ──────────────────────────────────────────────────

  /** 修改菜单项 */
  @Patch(':id')
  @Permissions(PERMISSIONS.MENU_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menuService.update(id, dto);
  }

  /**
   * 批量更新排序（拖拽排序）
   * PATCH /menu/sort
   * Body: [{ id: '...', sort: 0 }, { id: '...', sort: 1 }]
   */
  @Patch('sort')
  @Permissions(PERMISSIONS.MENU_UPDATE)
  updateSort(@Body() items: { id: string; sort: number }[]) {
    return this.menuService.updateSort(items);
  }

  // ─── 删除 ──────────────────────────────────────────────────

  /** 软删除菜单项（系统内置不可删） */
  @Delete(':id')
  @Permissions(PERMISSIONS.MENU_DELETE)
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }
}
