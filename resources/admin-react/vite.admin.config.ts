import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  base: "/build/react-admin/",
  define: { __FLEX_ADMIN_BASE__: JSON.stringify("/admin") },
  plugins: [react(), tailwindcss()],
  publicDir: false,
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: {
    outDir: "../../public/build/react-admin",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: path.resolve(import.meta.dirname, "./index.html") },
  },
})
