import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
