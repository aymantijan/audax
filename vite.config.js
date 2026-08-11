import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (not 'autoUpdate'): a long-lived tab across a deploy must NOT
      // silently swap its JS mid-session (stores/components could mismatch the
      // new bundle) — App.jsx listens for the waiting worker and shows a toast
      // the user acts on, same pattern as lazyRetry's chunk-404 recovery.
      registerType: 'prompt',
      injectRegister: null, // we call registerSW ourselves in main.jsx (needs the update-prompt hook)
      // Without this, `virtual:pwa-register/react` (imported by PwaUpdatePrompt.jsx)
      // doesn't exist under plain `vite dev` and the import 404s into an HTML
      // response — this makes the dev server register a real (non-precaching)
      // SW too, so the hook has something to talk to while developing.
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        // App-shell precache (JS/CSS/HTML) only — NOT images/fonts, this app has
        // none of consequence. Runtime API calls (Supabase, OpenRouter) are
        // deliberately NOT cached: stale financial/trading data offline is worse
        // than a failed request, and the app already reads from localStorage
        // first (local-first architecture) so it works offline without SW help
        // for anything already loaded once.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        // Old chunk hashes from a previous deploy must not linger once a new
        // one is precached — avoids the exact stale-bundle problem lazyRetry
        // works around for lazy routes, but at the service-worker cache layer.
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'AUDAX — Life & Trading Companion',
        short_name: 'AUDAX',
        description: 'Track trading, learning, finance, habits, and skills — one gamified companion for ambitious people.',
        start_url: '/today',
        display: 'standalone',
        background_color: '#0b0e14',
        theme_color: '#0b0e14',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy visualization/data libs in their own cacheable chunks
        // so a code change to the app doesn't re-download all vendors.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          d3: ['d3'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
