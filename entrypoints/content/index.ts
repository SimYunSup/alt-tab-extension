import { allowWindowMessaging, onMessage, sendMessage } from "webext-bridge/content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  registration: "manifest",
  main() {
    allowWindowMessaging("background");
    onMessage("get-tab-info", async () => {
      const tab = await chrome.tabs.getCurrent();
      const cookies = await chrome.cookies.getAll({
        url: tab?.url ?? "",
       });
      const tabInfo = {
        storage: {
          session: Object.keys(sessionStorage).map((key) => `${key}=${sessionStorage[key]}`).join("&"),
          cookies: JSON.stringify(cookies),
          local: Object.keys(localStorage).map((key) => `${key}=${localStorage[key]}`).join("&"),
        },
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY,
        },
      }
      return tabInfo;
    });
    onMessage("refresh-interval", async (message) => {
      const { type, interval } = message.data;
      let hidden = false;
      if (type === "idle") {
        function runIdleCallback() {
          window.requestIdleCallback(async () => {
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

