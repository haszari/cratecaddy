import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env': env, // Make env variables available in the app
    },
    server: {
      strictPort: true, // fail if our expected port is not available
      port: env.UI_PORT,
    },
  };
});

