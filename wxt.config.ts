import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: "src",
	extensionApi: "chrome",
	modules: ["@wxt-dev/module-svelte"],
	manifest: {
		permissions: ["activeTab", "scripting"],
		host_permissions: [
			"https://x.com/*",
			"https://twitter.com/*",
			"https://pbs.twimg.com/*",
		],
	},
});
