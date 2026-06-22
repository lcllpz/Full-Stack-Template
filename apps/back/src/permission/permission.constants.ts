import { Menu, MenuType } from '@/menu/entities/menu.entity';

/**
 * 系统权限码常量（单一数据源）
 *
 * 规则：模块:操作，全小写下划线
 * - 这里定义的每个 code 对应 menus 表中 type=BUTTON 的一条记录
 * - 种子脚本会将此文件中的常量同步到数据库，保证代码与数据库一致
 */
export const PERMISSIONS = {
  // 用户模块
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // 角色模块
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',

  // 菜单模块
  MENU_READ: 'menu:read',
  MENU_CREATE: 'menu:create',
  MENU_UPDATE: 'menu:update',
  MENU_DELETE: 'menu:delete',

  // 系统模块
  SYSTEM_LOG: 'system:log',
} as const;

export const menuList: Partial<Menu & { children?: Partial<Menu>[] }>[] = [
  {
    title: '用户管理',
    path: '/user',
    icon: 'user',
    type: MenuType.MENU,
    parentId: null,
    visible: true,
    isSystem: false,
    code: 'user:menu',
    children: [
      {
        title: '用户列表',
        type: MenuType.BUTTON,
        sort: 2,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.USER_READ,
      },
      {
        title: '用户创建',
        type: MenuType.BUTTON,
        sort: 3,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.USER_CREATE,
      },
      {
        title: '用户编辑',
        type: MenuType.BUTTON,
        sort: 4,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.USER_UPDATE,
      },
      {
        title: '用户删除',
        type: MenuType.BUTTON,
        sort: 5,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.USER_DELETE,
      },
    ],
  },
  {
    title: '角色管理',
    path: '/role',
    icon: 'role',
    type: MenuType.MENU,
    parentId: null,
    visible: true,
    isSystem: false,
    code: 'role:menu',
    children: [
      {
        title: '角色列表',
        type: MenuType.BUTTON,

        visible: false,
        isSystem: false,
        code: PERMISSIONS.ROLE_READ,
      },
      {
        title: '角色创建',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.ROLE_CREATE,
      },
      {
        title: '角色编辑',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.ROLE_UPDATE,
      },
      {
        title: '角色删除',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.ROLE_DELETE,
      },
    ],
  },
  {
    title: '菜单管理',
    path: '/menu',
    icon: 'menu',
    type: MenuType.MENU,
    parentId: null,
    visible: true,
    isSystem: false,
    code: 'menu:menu',
    children: [
      {
        title: '菜单列表',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.MENU_READ,
      },
      {
        title: '菜单创建',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.MENU_CREATE,
      },
      {
        title: '菜单编辑',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.MENU_UPDATE,
      },
      {
        title: '菜单删除',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.MENU_DELETE,
      },
    ],
  },
  {
    title: '系统管理',
    path: '/system',
    icon: 'setting',
    type: MenuType.MENU,
    parentId: null,
    visible: true,
    isSystem: false,
    code: 'system:menu',
    children: [
      {
        title: '操作日志',
        type: MenuType.BUTTON,
        visible: false,
        isSystem: false,
        code: PERMISSIONS.SYSTEM_LOG,
      },
    ],
  },
];

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
