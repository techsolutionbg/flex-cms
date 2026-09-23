import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss()],
  publicDir: false,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    origin: "http://localhost:5173",
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      host: "localhost",
      port: 5173,
      clientPort: 5173,
      protocol: "ws",
    },
  },
  build: {
    outDir: "../../public/build/admin",
    emptyOutDir: true,
    manifest: true,
    minify: mode === "production",
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "./src/admin.ts"),
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
