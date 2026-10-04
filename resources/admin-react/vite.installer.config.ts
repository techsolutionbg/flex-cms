import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  base: "/build/installer/",
  plugins: [react(), tailwindcss()],
  publicDir: false,
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: {
    outDir: "../../public/build/installer",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: path.resolve(import.meta.dirname, "./installer.html") },
  },
})
