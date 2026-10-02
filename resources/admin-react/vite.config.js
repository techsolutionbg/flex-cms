import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    server: {
        host: "0.0.0.0",
        port: 8090,
        strictPort: true,
        // Keep the browser host when forwarding requests. The backend validates
        // trusted hosts and must see localhost (or the LAN host), not Docker's
        // internal service name (`app`).
        proxy: {
            "/api": { target: "http://app", changeOrigin: false },
            "/installer-api": {
                target: "http://app",
                changeOrigin: false,
                rewrite: (path) => path.replace(/^\/installer-api/, "/install"),
                configure: (proxy) => {
                    const siteUrl = process.env.VITE_INSTALLER_SITE_URL;
                    if (siteUrl) proxy.on("proxyReq", (request) => request.setHeader("X-Flex-Installer-Site-Url", siteUrl));
                },
            },
        },
    },
});
