import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: { entry: ['src/index.ts'], format: ['esm'], dts: true, fixedExtension: false },
  // TEST_JUNIT=1 also writes JUnit XML for the 4.5 evidence script (#83).
  test: {
    reporters: process.env.TEST_JUNIT ? ['default', ['junit', { outputFile: 'test-results/junit.xml' }]] : ['default'],
  },
  run: { tasks: { build: 'vp pack', test: 'vp test run' } },
});
