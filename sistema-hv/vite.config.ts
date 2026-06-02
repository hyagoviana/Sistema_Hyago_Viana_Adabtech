// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Deploy target: Vercel (via Nitro), not Cloudflare.
//   - cloudflare: false  → disables the built-in @cloudflare/vite-plugin from the Lovable preset.
//   - nitro()            → official TanStack Start ↔ Vercel adapter; auto-detects Vercel at build
//                          time and emits the serverless output (Vercel Functions + Fluid Compute).
// Server entry stays redirected to src/server.ts (our SSR error wrapper).
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [nitro()],
});
