import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    proxy: {
      '/api/sharebazaar': {
        target: 'https://sharebazaar.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sharebazaar/, '/api'),
        secure: true,
      },
      '/api/nepsetty': {
        target: 'https://nepsetty.kokomo.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nepsetty/, '/api/stock'),
        secure: true,
      },
      '/api/nepse-server': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nepse-server/, ''),
        secure: false,
      },
      '/api/portfolio-db': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/portfolio-db/, ''),
        secure: false,
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
