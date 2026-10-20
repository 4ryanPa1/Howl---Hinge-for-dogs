import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appConfig from './src/config/app.config.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'howl-app-metadata',
      transformIndexHtml(html) {
        return html
          .replaceAll('__APP_NAME__', appConfig.name)
          .replaceAll('__APP_TAGLINE__', appConfig.tagline);
      },
    },
  ],
  base: '/',
});
