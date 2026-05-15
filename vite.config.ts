import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Portable TanStack Start config. Defaults to the Node server target which
// runs locally (`vite dev` / `node .output/server/index.mjs`) and deploys to
// Vercel without additional adapters. Override TANSTACK_START_TARGET to
// target a different platform.
export default defineConfig({
  server: { port: Number(process.env.PORT) || 8080, host: true },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
