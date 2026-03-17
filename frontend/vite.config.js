import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // ✅ Tot lo de Laravel API
      "/api": {
        target: "http://backend.test",
        changeOrigin: true,
        secure: false,
      },

      // ✅ Sanctum CSRF cookie
      "/sanctum": {
        target: "http://backend.test",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
