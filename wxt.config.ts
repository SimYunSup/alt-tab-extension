import { defineConfig } from "wxt";
import { patchCssModules } from "vite-css-modules"
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  modules: [
    "@wxt-dev/module-react",
    "@wxt-dev/auto-icons",
  ],
  vite(env) {
    return {
      plugins: [
        patchCssModules(),
        tailwindcss(),
        svgr(),
      ],
    };
  },
  manifest({
    browser,
  }) {
    const manifest = {
      name: "Alt Tab autoclose",
      description: "Alt Tab - easy to autoclose tabs",
      permissions: [
        "tabs",
        "tabGroups",
        "storage",
        "activeTab",
        "cookies",
        "nativeMessaging",
      ],
      host_permissions: [
        "<all_urls>",
      ],
    };
    if (browser === "firefox") {
      manifest.permissions.push("contextualIdentities");
    }
    return manifest;
  },
  autoIcons: {
    enabled: true,
    grayscaleOnDevelopment: false,
    baseIconPath: "./public/icon.png",
  },
});
