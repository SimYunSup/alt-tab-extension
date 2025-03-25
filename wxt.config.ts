import { defineConfig } from "wxt";
import { patchCssModules } from "vite-css-modules"
import tailwindcss from "@tailwindcss/vite";

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
      ],
    };
  },
  manifest({
    browser,
  }) {
    const manifest = {
      name: "Alt Tab - easy to autoclose tabs",
      description: "Alt Tab is a browser extension that allows you to easily close tabs that are not active.",
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
    baseIconPath: "./public/icon.svg",
  },
});
