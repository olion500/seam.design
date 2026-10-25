import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "xyflow", test: /node_modules[\\/]@xyflow[\\/]/ },
            { name: "radix", test: /node_modules[\\/](radix-ui|@radix-ui)[\\/]/ },
          ],
        },
      },
    },
  },
  test: { environment: "jsdom" },
});
