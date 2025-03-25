import { onMessage, sendMessage } from "webext-bridge/content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "ISOLATED",
  main(context) {
    onMessage("get-scroll-position", async (message) => {
      const { tabId } = message.data;
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id !== tabId) {
        return;
      }
      const scrollPosition = {
        x: window.scrollX,
        y: window.scrollY,
      };
      return scrollPosition;
    });
    onMessage("refresh-interval", async (message) => {
      const { type, interval } = message.data;
      let hidden = false;
      if (type === "idle") {
        function runIdleCallback() {
          context.requestIdleCallback(async () => {
            if (hidden) {
              const tab = await chrome.tabs.getCurrent();
              sendMessage("refresh-tab", { tabId: tab?.id });
              runIdleCallback();
            }
          }, { timeout: interval });
        }
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            hidden = true;
            runIdleCallback();
          } else {
            hidden = false;
          }
        });
      } else if (type === "visiblity") {
        document.addEventListener("visibilitychange", async () => {
          if (document.hidden) {
            const tab = await chrome.tabs.getCurrent();
            sendMessage("refresh-tab", { tabId: tab?.id });
          }
        });
      }
    });
  },
});

