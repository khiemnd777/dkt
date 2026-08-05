import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*"],
      manifest: false,
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: [
          "index.html",
          "assets/**/*.{js,css}",
          "icons/**/*.{png,svg,ico}",
          "manifest.webmanifest",
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            method: "POST",
          },
        ],
      },
    }),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@shared": new URL("./shared", import.meta.url).pathname,
    },
  },
  // The host-aware Worker serves the game shell through ASSETS in development, so the normal
  // transformIndexHtml refresh preamble is not injected. Disable HMR to keep the dev shell valid.
  server: { hmr: false },
  build: {
    sourcemap: process.env.SOURCE_MAPS === "true",
    target: "es2022",
  },
});
