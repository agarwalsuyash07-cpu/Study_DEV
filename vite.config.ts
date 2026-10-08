import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 3000 matches Supabase's default auth Site URL, so magic links work locally without config
  server: { port: 3000, strictPort: true },
})
