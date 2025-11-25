import { browser, defineContentScript } from "#imports";
import { getURLSetting } from "@/utils/Setting";
import { settingStorage } from "@/utils/storage";
import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";

// Check if current page is the web app
const webAppUrl = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173';
function isWebAppPage() {
  return window.location.href.startsWith(webAppUrl);
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  // registration: "manifest",
  async main() {
    allowWindowMessaging("background");

    // If this is the web app page, only handle communication, skip storage access
    if (isWebAppPage()) {
      console.log("[Content Script] Running on web app page - communication only mode");

      // Handle messages from web app
      window.addEventListener("message", (event) => {
        // Only accept messages from same origin
        if (event.origin !== window.location.origin) return;

        const message = event.data;
        if (message?.source !== "alt-tab-web") return;

        console.log("[Content Script] Received message from web app:", message.type);

        // Handle ping - respond with pong
        if (message.type === "ping") {
          window.postMessage({
            source: "alt-tab-extension",
            type: "pong",
            data: { success: true },
          }, "*");
        }

        // Handle get_extension_url - return the extension's base URL
        if (message.type === "get_extension_url") {
          const extensionUrl = browser.runtime.getURL("/");
          console.log("[Content Script] Returning extension URL:", extensionUrl);
          window.postMessage({
            source: "alt-tab-extension",
            type: "extension_url_response",
            data: { url: extensionUrl },
          }, "*");
        }

        // Handle restore tabs request
        if (message.type === "restore_tabs" && message.data?.tabs) {
          console.log("[Content Script] Processing restore_tabs request for", message.data.tabs.length, "tabs");

          const tabCount = message.data.tabs.length;

          // Send message to background script to restore tabs (fire and forget)
          console.log("[Content Script] Sending message to background script...");
          browser.runtime.sendMessage({
            type: "restore_tabs",
            tabs: message.data.tabs,
          }).catch(error => {
            console.warn("[Content Script] Background message error (tabs may still restore):", error);
          });

          // Immediately respond to web app - tabs will restore in background
          console.log("[Content Script] Sending success response to web app");
          window.postMessage({
            source: "alt-tab-extension",
            type: "restore_tabs_response",
            data: {
              success: true,
              count: tabCount,
            },
          }, "*");
        }
      });

      return;
    }

    onMessage("get-tab-info", () => {
      let storage: { session: string; local: string } = { session: "{}", local: "{}" };

      // Safely try to access sessionStorage
      try {
        if (typeof sessionStorage !== 'undefined') {
          const sessionData: Record<string, string> = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              sessionData[key] = sessionStorage.getItem(key) ?? '';
            }
          }
          storage.session = JSON.stringify(sessionData);
        }
      } catch (e) {
        console.warn("[Content Script] Cannot access sessionStorage:", e);
        storage.session = "{}";
      }

      // Safely try to access localStorage
      try {
        if (typeof localStorage !== 'undefined') {
          const localData: Record<string, string> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              localData[key] = localStorage.getItem(key) ?? '';
            }
          }
          storage.local = JSON.stringify(localData);
        }
      } catch (e) {
        console.warn("[Content Script] Cannot access localStorage:", e);
        storage.local = "{}";
      }

      const tabInfo = {
        storage: {
          session: storage.session,
          local: storage.local,
        },
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY,
        },
      };
      return tabInfo;
    });

    // Handle storage restoration from background script
    onMessage("restore-storage", (message) => {
      const { session, local, scrollPosition } = message.data as {
        session: string;
        local: string;
        scrollPosition: { x: number; y: number };
      };

      console.log("[Content Script] Restoring storage data...");

      // Restore sessionStorage
      if (session && session !== "{}") {
        try {
          const sessionData = JSON.parse(session) as Record<string, string>;
          for (const [key, value] of Object.entries(sessionData)) {
            sessionStorage.setItem(key, value);
          }
          console.log("[Content Script] SessionStorage restored:", Object.keys(sessionData).length, "items");
        } catch (e) {
          console.warn("[Content Script] Failed to restore sessionStorage:", e);
        }
      }

      // Restore localStorage
      if (local && local !== "{}") {
        try {
          const localData = JSON.parse(local) as Record<string, string>;
          for (const [key, value] of Object.entries(localData)) {
            localStorage.setItem(key, value);
          }
          console.log("[Content Script] LocalStorage restored:", Object.keys(localData).length, "items");
        } catch (e) {
          console.warn("[Content Script] Failed to restore localStorage:", e);
        }
      }

      // Restore scroll position
      if (scrollPosition && (scrollPosition.x !== 0 || scrollPosition.y !== 0)) {
        // Delay scroll to ensure page is fully rendered
        setTimeout(() => {
          window.scrollTo(scrollPosition.x, scrollPosition.y);
          console.log("[Content Script] Scroll position restored:", scrollPosition);
        }, 500);
      }

      return { success: true };
    });
    let idleDetector: IdleDetector | null = null;
    let controller = new AbortController();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    async function runRefreshInterval({
      tabId,
      enabled,
      interval,
    }: {
      tabId: number;
      enabled?: boolean;
      interval: number;
    }) {
      const url = window.location.href;

      let settings;
      try {
        settings = await settingStorage.getValue();
      } catch (e) {
        console.warn("[Content Script] Cannot access settings storage:", e);
        return;
      }

      const closeRule = getURLSetting(settings, url);
      if (!enabled) {
        if (intervalId) {
          clearInterval(intervalId);
          return;
        } else if (idleDetector) {
          controller.abort();
          idleDetector = null;
          return;
        }
      }
      if (closeRule.idleCondition !== "idle") {
        controller.abort();
        idleDetector = null;
      }
      if (closeRule.idleCondition === "idle") {
        controller = new AbortController();

        if (await IdleDetector.requestPermission() !== "granted") {
          return;
        }
        idleDetector = new IdleDetector();
        idleDetector.addEventListener("change", () => {
          if (idleDetector?.userState === "idle") {
            sendMessage("refresh-tab", { tabId }, "background");
          }
        });
        await idleDetector.start({
          threshold: interval,
          signal: controller.signal
        });
      } else if (closeRule.idleCondition === "visibility") {
        setInterval(() => {
          if (!document.hidden) {
            sendMessage("refresh-tab", { tabId }, "background");
          }
        }, interval);
        function onVisibilityChange() {
          if (document.hidden) {
            sendMessage("refresh-tab", { tabId }, "background");
          }
        }
        document.addEventListener("visibilitychange", onVisibilityChange, { signal: controller.signal });
      }
    }
    onMessage("refresh-interval", async (message) => {
      const { tabId, interval, enabled } = message.data;
      await runRefreshInterval({
        tabId: tabId,
        enabled,
        interval,
      });
    });
  },
});
