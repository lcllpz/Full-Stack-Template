# monorepo项目搭建

1. 配置turbo及启动脚本
2. 配置workspace
   > 删除依赖重新pnpm i

# 代码提交工程化

1. 统一管理
2. 使用工具：已安装依赖（根目录）

   | 类别          | 包                                                                                                      |
   | ------------- | ------------------------------------------------------------------------------------------------------- |
   | Lint / Format | `eslint@^9`、`prettier`、`typescript-eslint`、`eslint-config-next`、`eslint-config-prettier`、`globals` |
   | Git Hooks     | `husky`、`lint-staged`                                                                                  |
   | 提交规范      | `@commitlint/cli`、`@commitlint/config-conventional`、`commitizen`、`cz-git`                            |
