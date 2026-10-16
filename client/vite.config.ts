import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // xfwd adds X-Forwarded-For so the server rate-limits each real client, not the shared loopback address.
    proxy: {
      '/api': { target: 'http://localhost:4000', xfwd: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, xfwd: true },
    },
  },
});
