import { browser, defineContentScript } from "#imports";
import { settingStorage } from "@/utils/storage";
import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  registration: "manifest",
  async main() {
    allowWindowMessaging("background");
    onMessage("get-tab-info", async () => {
      const tabInfo = {
        storage: {
          session: Object.keys(sessionStorage).map((key) => `${key}=${sessionStorage[key]}`).join("&"),
          local: Object.keys(localStorage).map((key) => `${key}=${localStorage[key]}`).join("&"),
        },
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY,
        },
      }
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
      const closeRule = settings?.blocklist.find((block) => url?.startsWith(block.url))?.rule
      ?? settings.closeRules;
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
