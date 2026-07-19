import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['.vite/**', 'coverage/**', 'node_modules/**', 'out/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
);
