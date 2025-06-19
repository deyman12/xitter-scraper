import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-svelte"],
  manifestVersion: 3,
  manifest: {
    version: "3.0.0",
    description:
      "A browser extension that lets you download high-quality images from X/Twitter profiles in bulk.",
    host_permissions: undefined,
    permissions: [],
  },
});
