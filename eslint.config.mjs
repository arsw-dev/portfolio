import antfuConfig from '@antfu/eslint-config';
import { defineConfig } from 'eslint/config';

const createConfig = (options, ...userConfigs) => antfuConfig({
  type: 'app',
  typescript: true,
  formatters: true,
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
  ],
});

export default defineConfig(baseConfig);
