import { browser, defineContentScript } from "#imports";
import { getURLSetting } from "@/utils/Setting";
import { settingStorage } from "@/utils/storage";
import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";

function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  let storage;
  try {
    storage = window[type];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
}

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

        // Handle restore tabs request
        if (message.type === "restore_tabs" && message.data?.tabs) {
          console.log("[Content Script] Processing restore_tabs request for", message.data.tabs.length, "tabs");

          (async () => {
            try {
              // Send message to background script to restore tabs
              console.log("[Content Script] Sending message to background script...");
              const response = await browser.runtime.sendMessage({
                type: "restore_tabs",
                tabs: message.data.tabs,
              });

              console.log("[Content Script] Received response from background:", response);

              // Send response back to web app
              const responseData = {
                success: true,
                count: message.data.tabs.length,
                ...response
              };

              console.log("[Content Script] Sending response to web app:", responseData);

              window.postMessage({
                source: "alt-tab-extension",
                type: "restore_tabs_response",
                data: responseData,
              }, "*");
            } catch (error) {
              console.error("[Content Script] Failed to restore tabs:", error);
              window.postMessage({
                source: "alt-tab-extension",
                type: "restore_tabs_response",
                data: { success: false, error: String(error) },
              }, "*");
            }
          })();
        }
      });

      return;
    }

    onMessage("get-tab-info", () => {
      let storage: { session: string; local: string } = { session: "{}", local: "{}" };
      try {
        if (isStorageAvailable('sessionStorage')) {
          storage.session = JSON.stringify(Object.entries(sessionStorage));
        }
        if (isStorageAvailable('localStorage')) {
          storage.local = JSON.stringify(Object.entries(localStorage));
        }
      } catch (e) {
        console.error("Error serializing storage", e);
      }

      const tabInfo = {
        storage: {
          session: storage.session ?? "{}",
          local: storage.local ?? "{}",
        },
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY,
        },
      };
      return tabInfo;
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
      const settings = await settingStorage.getValue();
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
