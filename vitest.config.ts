import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.tsx',
      'tests/**/*.test.ts',
      'apps/seva.hub/src/**/*.test.ts',
      'apps/aol.guide/tests/**/*.test.ts'
    ]
  }
});
