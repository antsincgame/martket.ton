import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Слушаем все интерфейсы
    port: 8080, // DEV-сервер на уникальном порту 🚀
    strictPort: true, // Не пытаться использовать другой порт
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 8080,
      clientPort: 8080,
      overlay: true
    },
    watch: {
      usePolling: true,
      interval: 100
    },
    fs: {
      strict: true,
      allow: ['..']
    }
  },
  preview: {
    port: 4173, // PREVIEW на отдельном порту
    strictPort: true,
    host: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['react', 'react-dom', 'react-router-dom'],
    force: true
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'ton-vendor': ['@tonconnect/ui-react', '@tonconnect/sdk'],
          'ui-vendor': ['lucide-react']
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  cacheDir: '.vite_cache'
});
