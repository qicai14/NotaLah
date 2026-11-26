import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

const afterShared = [{ task: 'build', from: 'dependencies' as const }];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    // xfwd adds X-Forwarded-For so the server rate-limits each real client, not the shared loopback address.
    proxy: {
      '/api': { target: 'http://localhost:4000', xfwd: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, xfwd: true },
    },
  },
  test: {
    // TEST_JUNIT=1 also writes JUnit XML for the 4.5 evidence script (#83).
    reporters: process.env.TEST_JUNIT ? ['default', ['junit', { outputFile: 'test-results/junit.xml' }]] : ['default'],
  },
  run: {
    tasks: {
      build: { command: 'vp build', dependsOn: afterShared },
      test: {
        command: 'vp test run',
        dependsOn: afterShared,
        cache: { env: ['NODE_ENV'] },
      },
    },
  },
});
