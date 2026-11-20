import { defineConfig } from 'vitest/config';

// End-to-end tests run the real Nest app against a real MySQL database
// (TEST_DATABASE_URL), which global-setup wipes and re-migrates once per run.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/env-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Each test file signs up its own businesses, so files are independent;
    // running them one at a time keeps MySQL lock contention predictable.
    fileParallelism: false,
  },
});
