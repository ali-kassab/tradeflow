import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Nest DI and class-transformer read decorator metadata, like the tsc build emits.
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
