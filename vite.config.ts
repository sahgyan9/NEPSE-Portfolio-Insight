import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 8080,
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
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
