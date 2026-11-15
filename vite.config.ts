import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: { main: path.resolve(__dirname, 'index.html'), invitation: path.resolve(__dirname, 'invitation.html'), admin: path.resolve(__dirname, 'admin.html') },
      },
    },
    server: {
      allowedHosts: ['jlcitsolutions.com', '.jlcitsolutions.com', '.trycloudflare.com'],
      // `npm run dev:ui` gives hot reload; API and dynamic favicons come from `npm run dev` (wrangler) on 8788
      proxy: {
        '/api': 'http://localhost:8788',
        '/favicon.ico': 'http://localhost:8788',
        '/favicon.svg': 'http://localhost:8788',
      },
    },
  };
});
