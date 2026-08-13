import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    port: 3001,
    proxy: {
      // Same-origin API in local dev (matches production nginx → server).
      // Keep the browser Host header so cookies work when opening via host IP.
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
      "/rpc": {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
      "/api-reference": {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
});
