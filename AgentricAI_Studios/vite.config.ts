
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process'; // Removed: Rely on global process

export default ({ mode }: { mode: string }) => {
  // Load .env file variables.
  // process.cwd() will now use the global Node.js process object.
  // The third argument '' loads all variables, not just VITE_ prefixed ones.
  const env = loadEnv(mode, process.cwd(), '');

  return defineConfig({
    plugins: [react()],
    define: {
      // This makes environment variables from your .env file available
      // as process.env.VARIABLE_NAME in your client-side code.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // If you have other variables in .env you want to expose similarly:
      // 'process.env.ANOTHER_KEY': JSON.stringify(env.ANOTHER_KEY),
    }
  });
};