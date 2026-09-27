import antfuConfig from '@antfu/eslint-config';
import tanstackQueryPlugin from '@tanstack/eslint-plugin-query';
import { defineConfig } from 'eslint/config';

const createConfig = (options, ...userConfigs) => antfuConfig({
  type: 'app',
  typescript: true,
  formatters: true,
  unicorn: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: 'single',
  },
  ...options,
}, {
  rules: {
    'ts/consistent-type-definitions': ['error', 'type'],
    'no-console': ['warn'],
    'antfu/no-top-level-await': ['off'],
    'antfu/top-level-function': ['off'],
    'node/prefer-global/process': ['off'],
    'node/no-process-env': ['error'],
    'perfectionist/sort-imports': [
      'error',
    ],
    'unicorn/filename-case': [
      'error',
      {
        case: 'kebabCase',
        ignore: ['README.md', 'LICENSE'],
      },
    ],
  },
}, ...userConfigs);

const baseConfig = await createConfig({
  // Global Ignores
  ignores: [
    'LICENSE',
    '**/node_modules/**',
    '**/public/**',
    '**/routeTree.gen.ts',
    '**/dist/**',
    '**/README.md',
  ],
});

const reactConfig = await createConfig({
  react: true,
  plugins: {
    '@tanstack/query': tanstackQueryPlugin,
  },
}, {
  files: ['site/**/*'],
  rules: {
    'func-style': ['off'],
    'react/no-array-index-key': ['off'],
    'no-restricted-syntax': ['off'],
    'antfu/top-level-function': 'off',
    '@tanstack/query/exhaustive-deps': 'error',
    'react-refresh/only-export-components': ['off'],
  },
}).override('antfu/unicorn/rules', {
  rules: {
    'unicorn/filename-case': ['error', {
      case: 'kebabCase',
      ignore: ['README.md', '~__root.tsx'],
    }],
  },
});

export default defineConfig([baseConfig, reactConfig]);
