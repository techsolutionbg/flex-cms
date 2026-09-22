import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: "../../public/build/admin",
    emptyOutDir: true,
    manifest: true,
    minify: mode === "production",
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "./src/admin.tsx"),
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}))
