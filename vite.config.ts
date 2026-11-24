import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
        'apple-touch-icon.png',
        'seed-photo.jpg',
      ],
      manifest: {
        name: 'MindVault — Private Smart Notes',
        short_name: 'MindVault',
        description:
          'Privacy-first smart notes. Diary summaries and mood insights stay on your device; deep summaries go to the cloud only with your explicit approval.',
        theme_color: '#0f766e',
        background_color: '#faf7f2',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell only. AI calls are never cached.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
      },
    }),
  ],
})
