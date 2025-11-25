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
      build: {
        target: 'esnext',
      },
    };
  },
  modules: [
    "@wxt-dev/module-react",
    "@wxt-dev/auto-icons",
  ],
  imports: false,
  manifest({
    browser,
    mode,
  }) {
    const manifest = {
      name: "Alt Tab",
      description: "Alt Tab - easy to autoclose tabs",
      permissions: [
        "tabs",
        "tabGroups",
        "storage",
        "activeTab",
        "cookies",
        "nativeMessaging",
        "identity",
        "scripting"
      ],
      host_permissions: [
        "<all_urls>",
      ],
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
      },
      externally_connectable: {
        matches: [
          "http://localhost:*/*",
          "https://*.alt-tab.app/*",
          // Add your production domain here
        ],
      },
      web_accessible_resources: [
        {
          resources: ["web/*"],
          matches: ["<all_urls>"],
        },
      ],
    };
    if (mode === "development") {
      if (browser === "chrome" || browser === "edge") {
        (manifest as any).key = import.meta.env.VITE_MANIFEST_DEV_KEY;
      }
    }
    if (browser === "firefox") {
      manifest.permissions.push("contextualIdentities");
    }
    return manifest;
  },
  autoIcons: {
    enabled: true,
    developmentIndicator: false,
    baseIconPath: "./public/icon.png",
  },
});
