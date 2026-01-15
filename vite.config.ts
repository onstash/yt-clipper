import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 4347,
  },
  plugins: [
    tailwindcss(),
    // Enables Vite to resolve imports using path aliases
    tsConfigPaths(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "routes",
      },
    }),
    // React's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
