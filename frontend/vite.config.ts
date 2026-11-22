import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Request /api diteruskan ke backend gateway, jadi frontend tidak perlu tahu URL backend.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
