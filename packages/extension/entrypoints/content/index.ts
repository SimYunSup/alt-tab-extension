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

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  // registration: "manifest",
  async main() {
    allowWindowMessaging("background");
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
