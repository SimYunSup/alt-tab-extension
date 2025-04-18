import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite(env) {
    return {
      plugins: [
        tailwindcss(),
        svgr(),
      ],
    };
  },
  modules: [
    "@wxt-dev/module-react",
    "@wxt-dev/auto-icons",
  ],
  imports: false,
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
        "identity"
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
