// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'e2e-*.mts'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Mematikan aturan yang bentrok dengan Prettier. Format ditangani Prettier saja.
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
