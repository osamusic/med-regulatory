import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  
  // Get allowed hosts from environment variable
  const allowedHostsEnv = process.env.VITE_ALLOWED_HOSTS || 'localhost'
  const allowedHosts = allowedHostsEnv.split(',').map(host => host.trim())
  
  return {
    plugins: [react()],
    publicDir: 'public',
    resolve: {
      alias: {
        // Ensure single instance of React
        'react': path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom')
      }
    },
    server: {
      historyApiFallback: true,
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: allowedHosts
    },
    preview: {
      historyApiFallback: true
    },
    define: {
      __DEV__: !isProd,
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [] // Remove console.log and debugger in production
    },
    build: {
      target: 'es2015',
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false, // Disable source maps to reduce file count
      rollupOptions: {
        output: {
          // Code splitting for better chunk sizes
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['react-icons', 'framer-motion'],
            utils: ['axios', 'react-markdown']
          },
          // Optimize chunk and asset naming
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.')
            const ext = info[info.length - 1]
            if (/\.(css)$/.test(assetInfo.name)) {
              return `css/[name]-[hash].${ext}`
            }
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
              return `img/[name]-[hash].${ext}`
            }
            return `assets/[name]-[hash].${ext}`
          }
        }
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 500,
      // Remove unused CSS
      cssCodeSplit: true
    }
  }
})
