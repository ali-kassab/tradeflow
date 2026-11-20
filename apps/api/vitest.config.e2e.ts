import { defineConfig } from 'vitest/config';

// End-to-end tests run the real Nest app against a real SQL Server database
// (TEST_DATABASE_URL), which global-setup wipes and re-migrates once per run.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Nest DI and class-transformer read decorator metadata, like the tsc build emits.
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/env-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Each test file signs up its own businesses, so files are independent;
    // running them one at a time keeps SQL Server lock contention predictable.
    fileParallelism: false,
  },
});
