import { defineContentScript } from "#imports";
import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  registration: "manifest",
  main() {
    let intervalId: ReturnType<typeof setInterval> | null = null;
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
    let idleDetector: IdleDetector | null;
    let controller = new AbortController();
    onMessage("refresh-interval", async (message) => {
      const { type, tabId, interval, enabled } = message.data;
      if (!enabled) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          return;
        } else if (idleDetector) {
          controller.abort();
          idleDetector = null;
          return;
        }
      }
      if (type !== "idle") {
        controller.abort();
        idleDetector = null;
      }
      if (type === "idle") {
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
      } else if (type === "visiblity") {
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
    });
  },
});

