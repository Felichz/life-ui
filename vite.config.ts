import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vendors en chunks propios: cambian poco y el navegador los mantiene en caché
const VENDOR_CHUNKS: Record<string, string[]> = {
  react: ["react", "react-dom", "scheduler", "react-router", "react-router-dom"],
  ui: ["@radix-ui", "@floating-ui", "lucide-react", "react-remove-scroll", "aria-hidden"],
  dnd: ["@hello-pangea/dnd", "redux", "react-redux", "css-box-model", "raf-schd"],
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Puerto fijo: Cypress apunta aquí (npm run dev + npm run test:e2e)
  server: { port: 5174 },
  preview: { port: 5174 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const modulePath = id.split("node_modules/").pop() ?? "";
          for (const [chunk, packages] of Object.entries(VENDOR_CHUNKS)) {
            if (packages.some((name) => modulePath.startsWith(`${name}/`))) return chunk;
          }
          return undefined;
        },
      },
    },
  },
});
