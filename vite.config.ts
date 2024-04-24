import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/**/__tests__/**/*.ts?(x)', 'src/**/*.test.ts?(x)'],
    coverage: {
      include: ['src/**/*.ts?(x)'],
      reportsDirectory: 'docs/coverage',
      reporter: (process.env.POB_VITEST_COVERAGE || 'json,text').split(','),
    },
  },
});
