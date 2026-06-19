import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      workbox: {
        // Usa NetworkFirst para que la app se actualice sola instantáneamente si hay internet
        runtimeCaching: [{
          urlPattern: /^https:\/\/.*|http:\/\/localhost.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'app-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
            },
            networkTimeoutSeconds: 5
          }
        }]
      },
      manifest: {
        name: 'Granja Admin',
        short_name: 'Granja',
        description: 'Administración de la Granja',
        theme_color: '#10b981',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
