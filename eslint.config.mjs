import { defineConfig, globalIgnores } from 'eslint/config';
import nextConfig from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

const frontFiles = ['apps/front/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'];
const backSourceFiles = ['apps/back/src/**/*.ts'];
const backTestFiles = ['apps/back/test/**/*.ts', 'apps/back/**/*.spec.ts'];

const importSortGroups = [
  ['^\\u0000'],
  ['^node:'],
  ['^react', '^next', '^@?\\w'],
  ['^@/'],
  ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
  ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
  ['^.+\\.s?css$'],
];

const importSortRules = {
  'simple-import-sort/imports': ['error', { groups: importSortGroups }],
  'simple-import-sort/exports': 'error',
};

const tailwindCanonicalPatterns = [
  {
    pattern: '\\bbg-gradient-to-(t|tr|r|br|b|bl|l|tl)\\b',
    message:
      'Tailwind v4 规范：请将 `bg-gradient-to-*` 改为 `bg-linear-to-*`（例如 `bg-linear-to-b`）。',
  },
  {
    pattern: '\\bbg-gradient-radial\\b',
    message: 'Tailwind v4 规范：请将 `bg-gradient-radial` 改为 `bg-radial`。',
  },
  {
    pattern: '\\bbg-gradient-conic\\b',
    message: 'Tailwind v4 规范：请将 `bg-gradient-conic` 改为 `bg-conic`。',
  },
  {
    pattern: '\\bbg-\\[size:[^\\]]+\\]',
    message: 'Tailwind v4 规范：请将 `bg-[size:...]` 改为 `bg-size-[...]`。',
  },
];

const tailwindCanonicalSyntaxRules = tailwindCanonicalPatterns.flatMap(
  ({ pattern, message }) => [
    {
      selector: `Literal[value=/${pattern}/]`,
      message,
    },
    {
      selector: `TemplateElement[value.raw=/${pattern}/]`,
      message,
    },
  ],
);

const backTypeAwareParserOptions = {
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
};

const backTestRelaxedRules = {
  '@typescript-eslint/await-thenable': 'off',
  '@typescript-eslint/no-floating-promises': 'off',
  '@typescript-eslint/no-unnecessary-type-assertion': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/restrict-plus-operands': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
};

function scopeToFront(configs) {
  return configs.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [entry];
    }

    if (Array.isArray(entry.ignores)) {
      return [
        {
          ignores: entry.ignores.map((pattern) =>
            pattern.startsWith('!')
              ? `!apps/front/${pattern.slice(1)}`
              : `apps/front/${pattern}`,
          ),
        },
      ];
    }

    return [{ ...entry, files: frontFiles }];
  });
}

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.turbo/**',
    'apps/front/.next/**',
    'apps/front/out/**',
    'apps/back/dist/**',
    '**/coverage/**',
  ]),
  ...scopeToFront(nextConfig),
  ...scopeToFront(nextTs),
  {
    files: frontFiles,
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      next: {
        rootDir: 'apps/front/',
      },
    },
    rules: {
      ...importSortRules,
      'no-restricted-syntax': ['error', ...tailwindCanonicalSyntaxRules],
    },
  },
  {
    files: backSourceFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      globals: globals.node,
      parserOptions: backTypeAwareParserOptions,
    },
    rules: importSortRules,
  },
  {
    files: backTestFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      globals: globals.node,
      parserOptions: backTypeAwareParserOptions,
    },
    rules: {
      ...importSortRules,
      ...backTestRelaxedRules,
    },
  },
  eslintConfigPrettier,
]);
