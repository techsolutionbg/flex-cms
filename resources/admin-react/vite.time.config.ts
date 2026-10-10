import path from "node:path"
import { defineConfig } from "vite"

// Builds the public time module served by the platform at /assets/flex-time.js.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "../../public/assets",
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "./src/lib/flex-time-public.ts"),
      formats: ["es"],
      fileName: () => "flex-time.js",
    },
  },
})
