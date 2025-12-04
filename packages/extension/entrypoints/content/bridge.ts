// Content script for bridging web page and extension
// This runs on the web app domain to enable communication

import { browser, defineContentScript } from "#imports";

export default defineContentScript({
  matches: [
    (import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173') + '/*',
  ],
  main() {
    console.log("[Alt-Tab Bridge] Content script loaded");

    // Listen for messages from web page
    window.addEventListener("message", async (event) => {
      // Only accept messages from same origin
      if (event.source !== window) return;

      const message = event.data;

      // Check if it's an Alt-Tab message
      if (!message || message.source !== "alt-tab-web") return;

      console.log("[Alt-Tab Bridge] Received message from web page:", message);

      try {
        if (message.type === "ping") {
          // Extension is installed, respond immediately
          window.postMessage(
            {
              source: "alt-tab-extension",
              type: "pong",
              data: { success: true, version: "0.0.1" },
            },
            "*"
          );
        } else if (message.type === "restore_tabs") {
          // Forward to background script
          const tabs = message.data?.tabs || [];

          for (const tab of tabs) {
            await browser.tabs.create({
              url: tab.url,
              active: false,
            });
          }

          // Send success response
          window.postMessage(
            {
              source: "alt-tab-extension",
              type: "restore_tabs_response",
              data: { success: true, count: tabs.length },
            },
            "*"
          );
        }
      } catch (error) {
        console.error("[Alt-Tab Bridge] Error handling message:", error);
        window.postMessage(
          {
            source: "alt-tab-extension",
            type: "error",
            data: { success: false, error: String(error) },
          },
          "*"
        );
      }
    });

    // Signal that bridge is ready
    window.postMessage(
      {
        source: "alt-tab-extension",
        type: "ready",
      },
      "*"
    );
  },
});
