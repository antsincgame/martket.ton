import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { tonconnectManifestPlugin } from './vite-plugin-tonconnect-manifest';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tonconnectManifestPlugin(), react()],
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    allowedHosts: true,
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
    port: 4173,
    strictPort: true,
    host: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
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
