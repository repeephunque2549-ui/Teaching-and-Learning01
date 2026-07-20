import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/compile/coliru': {
        target: 'https://coliru.stacked-crooked.com/compile',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/compile\/coliru/, '')
      },
      '/api/compile/godbolt': {
        target: 'https://godbolt.org/api/compiler',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/compile\/godbolt\/(.*)/, '$1/compile')
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
              return 'monaco-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
            if (id.includes('react-dom') || id.includes('react/')) {
              return 'react-vendor';
            }
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'lucide-react',
    ],
    exclude: [
      // Monaco editor is lazily loaded via React.lazy, exclude from pre-bundling
      '@monaco-editor/react',
    ],
  },
})
