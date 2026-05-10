import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env': env,
    },
    resolve: {
      alias: {
        '@cratecaddy-api': path.resolve(__dirname, '../api/src/helpers'),
      },
    },
    server: {
      strictPort: true,
      port: Number(env.UI_PORT),
    },
  };
});
