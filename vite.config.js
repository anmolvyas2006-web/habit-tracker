import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-app-on-root',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '') req.url = '/app.html';
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: 'app.html'
    }
  }
});
