import path from 'path';
import {defineConfig} from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@emoji-datasource-facebook': path.resolve(
        __dirname,
        'node_modules/emoji-datasource-facebook/img/facebook/64/',
      ),
    },
  },
});
