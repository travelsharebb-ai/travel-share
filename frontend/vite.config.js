import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("mapbox-gl")) return "vendor-mapbox-gl";
          if (id.includes("react-router-dom")) return "vendor-react-router";
          if (id.includes("react-dom") || id.includes("react/jsx-runtime") || id.includes("/react/")) {
            return "vendor-react";
          }
          return "vendor";
        }
      }
    }
  }
});
