import mdx from '@mdx-js/rollup';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import rehypePrettyCode from 'rehype-pretty-code';
import { defineConfig } from 'vite';
import { arswTheme } from './src/lib/shiki-theme';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    { enforce: 'pre', ...mdx({ rehypePlugins: [[rehypePrettyCode, { theme: arswTheme }]] }) },
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
});

export default config;
