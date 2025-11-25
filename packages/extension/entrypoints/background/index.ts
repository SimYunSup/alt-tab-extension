import type { Browser } from "wxt/browser";
import type { ClientTabInfo, TabInfo, StorageInfo, ScrollPosition } from "@/utils/Tab";
import type { Setting } from "@/types/data";

import { browser } from 'wxt/browser';
import { defineBackground } from "#imports";
import { onMessage, sendMessage } from "webext-bridge/background";
import { convertToClientTabInfo, getDefaultNewTabUrl, saveTabIndexedDB } from "@/utils/Tab";
import { isClosableTab } from "@/utils/Tab";
import { getSetting, getURLSetting, initSettingIfLogin, saveSetting } from "@/utils/Setting";
import { currentTabStorage, settingStorage, accessTokenStorage, refreshTokenStorage } from "@/utils/storage";
import { archiveTabGroup } from "@/utils/ArchivedTabGroup";
// Setup mock API in development mode (sync import)
import { setupMockAPI } from '@/mocks/setup';

/**
 * Interface for restored tab data (from web app or content script)
 * Contains encrypted storage data that needs to be decrypted
 */
interface RestoredTabInfo {
  url: string;
  title?: string;
  faviconUrl?: string;
  scrollPosition?: { x: number; y: number };
  session?: string;   // Encrypted or decrypted session storage data
  cookie?: string;    // Encrypted or decrypted cookie data (JSON string of cookie array)
  local?: string;     // Encrypted or decrypted local storage data
}

/**
 * Restores a tab with its associated data (cookies, session/local storage, scroll position)
 */
async function restoreTabWithData(tabInfo: RestoredTabInfo): Promise<void> {
  console.log("[Background] Restoring tab:", tabInfo.url);

  // 1. First, restore cookies before opening the tab
  if (tabInfo.cookie) {
    try {
      const cookies = JSON.parse(tabInfo.cookie) as Browser.cookies.SetDetails[];
      console.log("[Background] Restoring", cookies.length, "cookies for", tabInfo.url);

      for (const cookie of cookies) {
        try {
          // Build the cookie URL
          const protocol = cookie.secure ? 'https://' : 'http://';
          const domain = cookie.domain?.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
          const cookieUrl = `${protocol}${domain}${cookie.path || '/'}`;

          await browser.cookies.set({
            url: cookieUrl,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            sameSite: cookie.sameSite as Browser.cookies.SameSiteStatus || 'lax',
            expirationDate: cookie.expirationDate,
          });
          console.log("[Background] Cookie set:", cookie.name, "for domain:", cookie.domain);
        } catch (cookieError) {
          console.warn("[Background] Failed to set cookie:", cookie.name, cookieError);
        }
      }
    } catch (error) {
      console.error("[Background] Failed to parse cookies:", error);
    }
  }

  // 2. Create the tab
  const newTab = await browser.tabs.create({
    url: tabInfo.url,
    active: false,
  });

  if (!newTab.id) {
    console.error("[Background] Failed to create tab - no ID returned");
    return;
  }

  console.log("[Background] Tab created with ID:", newTab.id);

  // 3. Wait for tab to load and inject storage data
  if (tabInfo.session || tabInfo.local || tabInfo.scrollPosition) {
    // Wait for tab to complete loading (with shorter timeout)
    const waitForTabLoad = (tabId: number): Promise<void> => {
      return new Promise((resolve) => {
        let resolved = false;
        const checkTab = async () => {
          if (resolved) return;
          try {
            const tab = await browser.tabs.get(tabId);
            if (tab.status === 'complete') {
              resolved = true;
              resolve();
            } else {
              setTimeout(checkTab, 200);
            }
          } catch {
            // Tab might be closed
            resolved = true;
            resolve();
          }
        };

        // Timeout after 5 seconds (reduced from 10)
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log("[Background] Tab load timeout, continuing anyway");
            resolve();
          }
        }, 5000);
        checkTab();
      });
    };

    await waitForTabLoad(newTab.id);

    // Send storage data to content script for restoration
    try {
      console.log("[Background] Sending storage data to content script...");
      await sendMessage("restore-storage", {
        session: tabInfo.session || "{}",
        local: tabInfo.local || "{}",
        scrollPosition: tabInfo.scrollPosition || { x: 0, y: 0 },
      }, `content-script@${newTab.id}`);
      console.log("[Background] Storage restoration message sent to tab:", newTab.id);
    } catch (error) {
      console.warn("[Background] Failed to send storage data to content script:", error);
    }
  }
}

// Enable mock API in development or when VITE_USE_MOCK_API is set
if (import.meta.env.VITE_USE_MOCK_API === 'true') {
  console.log('[Background] Setting up Mock API...');
  setupMockAPI();
}

const DEFAULT_INTERVAL = 10_000;

export default defineBackground(() => {
  let intervalResult: [string, boolean][] = [];

  // Enable chrome.storage.session access from content scripts
  // This must be called before any storage access from untrusted contexts
  if (typeof chrome !== 'undefined' && chrome.storage?.session?.setAccessLevel) {
    chrome.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    }).then(() => {
      console.log('[Background] chrome.storage.session access level set to TRUSTED_AND_UNTRUSTED_CONTEXTS');
    }).catch((error) => {
      console.warn('[Background] Failed to set storage.session access level:', error);
    });
  }

  // Inject content script into existing tabs on extension load
  async function injectContentScriptToExistingTabs() {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      // Skip non-injectable URLs
      if (tab.url.startsWith("chrome://") ||
          tab.url.startsWith("chrome-extension://") ||
          tab.url.startsWith("about:") ||
          tab.url.startsWith("edge://") ||
          tab.url.startsWith("moz-extension://")) {
        continue;
      }
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content-scripts/content.js"],
        });
        console.log("[Background] Injected content script into tab", tab.id, tab.url);
      } catch (error) {
        console.warn("[Background] Failed to inject content script into tab", tab.id, error);
      }
    }
  }

  async function init() {
    let listClearInterval: () => void = () => { };
    await injectContentScriptToExistingTabs();
    await initTab();
    settingStorage.watch(async (setting) => {
      if (!setting) {
        return;
      }
      listClearInterval();
      await initTab();
    });
    // TODO: Forbidden?
    async function refreshTokens(accessToken?: string, refreshToken?: string) {
      accessToken = accessToken ?? await accessTokenStorage.getValue() ?? undefined;
      refreshToken = refreshToken ?? await refreshTokenStorage.getValue() ?? undefined;
      if (!accessToken || !refreshToken) {
        await accessTokenStorage.removeValue();
        await refreshTokenStorage.removeValue();
      }
      const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/refresh-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          refreshToken,
        }),
      });
      if (!response.ok) {
        console.error("Failed to refresh tokens", response.statusText);
        // await accessTokenStorage.removeValue();
        // await refreshTokenStorage.removeValue();
        return;
      }
      const data = await response.json() as { accessToken?: string; refreshToken?: string; };
      if (data.accessToken && data.refreshToken) {
        accessTokenStorage.setValue(data.accessToken);
        refreshTokenStorage.setValue(data.refreshToken);
      } else {
        console.error("Invalid token response", data);
      }
    }
    browser.runtime.onStartup.addListener(async () => {
      await initTab();
      await refreshTokens();
      const token = await accessTokenStorage.getValue();
      if (token) {
        await initSettingIfLogin(token);
      }
    });
    // Oauth flow
    function detectOauthFlow(_url: string) {
      const url = new URL(_url);
      const hash = url.hash;
      const accessToken = /access_token=([a-zA-Z0-9\.\-\_]+)/.exec(hash)?.[1];
      const refreshToken = /refresh_token=([a-zA-Z0-9\.\-\_]+)/.exec(hash)?.[1];
      if (!accessToken || !refreshToken) {
        return;
      }
      accessTokenStorage.setValue(accessToken);
      refreshTokenStorage.setValue(refreshToken);
      return {
        accessToken,
        refreshToken,
      }
    }
    // Tab event - combined with OAuth detection
    browser.tabs.onCreated.addListener(async (tab) => {
      if (!tab.id) {
        return;
      }
      // Handle OAuth flow first - only handle actual OAuth callback URLs (with access_token in hash)
      if (tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL) && tab.url.includes("#access_token=")) {
        const tokens = detectOauthFlow(tab.url);
        try {
          await browser.tabs.remove(tab.id);
        } catch (error) {
          console.debug("Failed to remove tab", error);
        }
        void refreshTokens(tokens?.accessToken, tokens?.refreshToken);
        return; // Don't process OAuth tabs further
      }
      const setting = await getSetting();
      let tabs = await currentTabStorage.getValue();
      tabs = tabs ?? {};
      const currentTabInfo = convertToClientTabInfo(tab);

      // Skip if tab ID is invalid (empty string)
      if (!currentTabInfo.id) {
        console.debug("[Background] Tab created with invalid ID, skipping");
        return;
      }

      tabs[currentTabInfo.id] = currentTabInfo;
      const result = addRefreshInterval(currentTabInfo, setting);
      intervalResult.push([currentTabInfo.id, result]);
      await currentTabStorage.setValue(tabs);
    });
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (!tab.id) {
        return;
      }
      // Handle OAuth flow first - only handle actual OAuth callback URLs (with access_token in hash)
      if (tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL) && tab.url.includes("#access_token=")) {
        // Remove OAuth tab from storage if it was added
        let tabs = await currentTabStorage.getValue();
        if (tabs && tabs[tabId]) {
          delete tabs[tabId];
          await currentTabStorage.setValue(tabs);
        }
        if (tab.active) {
          detectOauthFlow(tab.url);
          try {
            await browser.tabs.remove(tab.id);
          } catch (error) {
            console.debug("Failed to remove tab", error);
          }
        }
        return; // Don't process OAuth tabs further
      }
      let tabs = await currentTabStorage.getValue();
      tabs = tabs ?? {};
      const currentTabInfo = convertToClientTabInfo(tab);

      // Skip if tab ID is invalid (empty string)
      if (!currentTabInfo.id) {
        console.debug("[Background] Tab updated with invalid ID, skipping");
        return;
      }
      tabs[tabId] = currentTabInfo;

      if (changeInfo.status === "complete") {
        const setting = await getSetting();
        const result = addRefreshInterval(currentTabInfo, setting);
        const index = intervalResult.findIndex(([id]) => id === String(tabId));
        if (index !== -1) {
          intervalResult[index][1] = result;
        } else {
          intervalResult.push([String(tabId), result]);
        }
      }
      await currentTabStorage.setValue(tabs);
    });
    browser.tabs.onReplaced.addListener(async (tabId, removedTabId) => {
      if (!tabId || !removedTabId) {
        return;
      }
      let tabs = await currentTabStorage.getValue();
      tabs = tabs ?? {};
      const currentTabInfo = tabs[removedTabId];
      if (currentTabInfo && currentTabInfo.id) {
        delete tabs[removedTabId];
        tabs[tabId] = currentTabInfo;
        const setting = await getSetting();
        const result = addRefreshInterval(currentTabInfo, setting);
        intervalResult.push([String(tabId), result]);
        await currentTabStorage.setValue(tabs);
      }
    })
    browser.tabs.onRemoved.addListener(async (tabId) => {
      if (!tabId) {
        return;
      }
      let tabs = await currentTabStorage.getValue();
      tabs = tabs ?? {};
      const currentTabInfo = tabs[tabId];
      if (currentTabInfo) {
        delete tabs[tabId];
        await currentTabStorage.setValue(tabs);
      }
    });
    settingStorage.watch(
      async function (setting) {
        const tabs = await currentTabStorage.getValue();
        if (!tabs) {
          return;
        }
        for (const [tabId, tabInfo] of Object.entries(tabs)) {
          const closeRule = Object.entries(setting.whitelistUrls).find(([url]) => tabInfo.url.startsWith(url))?.[1]
            ?? setting.globalRule;
          const isOutdatedTab = closeRule.idleTimeout > 0 && tabInfo.lastActiveAt < Date.now() - 1000 * 60 * closeRule.idleTimeout;
          try {
            const tab = await browser.tabs.get(Number(tabId));
            if (!tab || !tab.id) {
              console.debug("[Background] Tab no longer exists:", tabId);
              continue;
            }
            if (isOutdatedTab && await isClosableTab(tab, setting)) {
              await Promise.all([
                browser.tabs.remove(tab.id),
                saveTabIndexedDB(tab, tabInfo)
              ]);
            }
          } catch (error) {
            console.debug("[Background] Tab is closed:", tabId, error);
            continue;
          }
        }
        const token = await accessTokenStorage.getValue();
        if (token) {
          await saveSetting(setting, token);
        }
      })
    async function initTab() {
      const tabs = await browser.tabs.query({});
      const setting = await getSetting();
      const clientTabArray = tabs.map((tab) => convertToClientTabInfo(tab))
        .filter((tab) => tab.id && !tab.url.includes(import.meta.env.VITE_OAUTH_BASE_URL)); // Filter out tabs with invalid IDs
      await currentTabStorage.setValue(Object.fromEntries(clientTabArray.map((tab) => [tab.id, tab])));
      if (setting.globalRule.idleCondition === "window") {
        browser.tabs.onActivated.addListener(onActivated);
      } else {
        browser.tabs.onActivated.removeListener(onActivated);
      }
      intervalResult = clientTabArray.map((tab) => {
        const success = addRefreshInterval(tab, setting);
        return [tab.id, success] as const;
      });
      const sharedIntervalId = setInterval(async () => {
        const setting = await getSetting();
        if (setting.globalRule.idleCondition !== "window") {
          return;
        }
        const activeTabs = await browser.tabs.query({ active: true });
        const clientTabs = await currentTabStorage.getValue();
        if (!clientTabs) {
          return;
        }
        for (const activeTab of activeTabs) {
          if (!activeTab.id) {
            continue;
          }
          const tabInfo = clientTabs[String(activeTab.id)];
          if (tabInfo) {
            const currentTabInfo = convertToClientTabInfo(activeTab);
            // Skip if converted tab has invalid ID
            if (!currentTabInfo.id) {
              continue;
            }
            clientTabs[activeTab.id] = currentTabInfo;
          }
        }
        await currentTabStorage.setValue(clientTabs);
      }, DEFAULT_INTERVAL);

      listClearInterval = () => {
        Promise.all(intervalResult.map(([tabId, isContentScript]) => {
          if (isContentScript) {
            return sendMessage("refresh-interval", {
              type: "idle", // whatever
              tabId: Number(tabId),
              interval: DEFAULT_INTERVAL,
              enabled: false,
            });
          }
          return undefined;
        }));
        clearInterval(sharedIntervalId);
      };
    }
  }

  function addRefreshInterval(tab: ClientTabInfo, setting: Setting) {
    if (!tab.id) {
      console.debug("[Background] Cannot add refresh interval - tab has no id");
      return false;
    }

    if (setting.globalRule.idleCondition === "idle" && (
      import.meta.env.CHROME ||
      import.meta.env.EDGE
    )) {
      sendMessage("refresh-interval", {
        type: "idle",
        tabId: Number(tab.id),
        interval: setting.refreshInterval ?? DEFAULT_INTERVAL,
        enabled: setting.globalRule.idleTimeout > 0,
      }, `content-script@${tab.id}`);
      return true;
    } else if (setting.globalRule.idleCondition === "visibility") {
      sendMessage("refresh-interval", {
        type: "visibility",
        tabId: Number(tab.id),
        interval: setting.refreshInterval ?? DEFAULT_INTERVAL,
        enabled: setting.globalRule.idleTimeout > 0,
      }, `content-script@${tab.id}`);
      return true;
    }
    return false;
  }
  onMessage("refresh-tab", async (message) => {
    const { tabId } = message.data;
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab || !tab.id) {
        console.debug("[Background] Tab not found for refresh:", tabId);
        return;
      }
      const clientTabs = await currentTabStorage.getValue();
      if (!clientTabs) {
        return;
      }
      const tabInfo = clientTabs[String(tabId)];
      if (tabInfo) {
        const currentTabInfo = convertToClientTabInfo(tab);
        clientTabs[tabId] = currentTabInfo;
      }
      await currentTabStorage.setValue(clientTabs);
    } catch (error) {
      console.debug("[Background] Failed to refresh tab:", tabId, error);
    }
  });
  onMessage("send-tab-group", async (message) => {
    const { tabIds, secret, salt } = message.data as { tabIds: number[], secret: string, salt: string };
    try {
      console.log("[Background] Received send-tab-group message for tabs:", tabIds);
      if (!secret || !salt) {
        console.error("[Background] Secret and salt are required for tab group archiving");
        return false;
      }

      console.log("[Background] Step 1: Getting tab info...");
      const tabs = await Promise.all(
        tabIds.map(async (tabId) => {
          try {
            return await browser.tabs.get(tabId);
          } catch (error) {
            console.error(`[Background] Failed to get tab ${tabId}:`, error);
            return null;
          }
        })
      );

      const validTabs = tabs.filter((tab): tab is Browser.tabs.Tab => tab !== null && tab.id !== undefined);
      if (validTabs.length === 0) {
        console.error("[Background] No valid tabs found");
        return false;
      }

      console.log("[Background] Step 2: Converting to server format...");
      const tabInfos = await Promise.all(validTabs.map((tab) => convertTabInfoServer(tab, convertToClientTabInfo(tab))));
      console.log("[Background] Step 3: Archiving tab group...");

      const result = await archiveTabGroup(tabInfos, secret, salt);
      console.log("[Background] Step 4: Archive result:", result);

      if (result) {
        console.log("[Background] Tab group archived successfully with ID:", result.id);
        return true;
      }

      return false;
    } catch (error) {
      console.error("[Background] Failed to archive tab group:", error);
      return false;
    }
  });

  // Handle messages from content script (for web app communication)
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("[Background] Received message from content script:", message);

    if (message.type === "restore_tabs" && message.tabs) {
      // Restore tabs from shared tab group with full data restoration
      (async () => {
        try {
          for (const tab of message.tabs) {
            await restoreTabWithData(tab);
          }
          sendResponse({ success: true, count: message.tabs.length });
        } catch (error) {
          console.error("[Background] Failed to restore tabs:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true; // Keep the message channel open for async response
    }

    return false;
  });

  // Handle external messages from web app (for tab restoration)
  browser.runtime.onMessageExternal.addListener(
    (message: { type: string; tabs?: Array<RestoredTabInfo> }, _sender, sendResponse) => {
      console.log("[Background] Received external message:", message);

      if (message.type === "ping") {
        // Extension is installed, respond with confirmation
        sendResponse({ success: true, version: "0.0.1" });
        return true;
      }

      if (message.type === "open_settings") {
        // Open extension settings page
        const settingsUrl = browser.runtime.getURL("/popup.html") + "#/page/settings";
        browser.tabs.create({ url: settingsUrl });
        sendResponse({ success: true, url: settingsUrl });
        return true;
      }

      if (message.type === "get_extension_url") {
        // Return the extension's base URL
        const baseUrl = browser.runtime.getURL("/");
        sendResponse({ success: true, url: baseUrl });
        return true;
      }

      if (message.type === "open_web") {
        // Open embedded web app page
        const path = (message as { path?: string }).path || "";
        const webUrl = browser.runtime.getURL("/web/index.html") + path;
        browser.tabs.create({ url: webUrl });
        sendResponse({ success: true, url: webUrl });
        return true;
      }

      if (message.type === "restore_tabs" && message.tabs) {
        // Restore tabs from shared tab group with full data restoration
        (async () => {
          try {
            for (const tab of message.tabs!) {
              await restoreTabWithData(tab);
            }
            sendResponse({ success: true, count: message.tabs!.length });
          } catch (error) {
            console.error("[Background] Failed to restore tabs:", error);
            sendResponse({ success: false, error: String(error) });
          }
        })();
        return true; // Keep the message channel open for async response
      }

      sendResponse({ success: false, error: "Unknown message type" });
      return true;
    }
  );

  init();
});

async function onActivated(info: Browser.tabs.OnActivatedInfo) {
  let tab: Browser.tabs.Tab | undefined;
  try {
    tab = await browser.tabs.get(info.tabId);
    if (!tab || !tab.id) {
      console.debug("[Background] Tab not found in onActivated:", info.tabId);
      return;
    }
  } catch (error) {
    console.debug("[Background] Failed to get tab in onActivated:", info.tabId, error);
    return;
  }
  const settings = await getSetting();
  const closeRule = getURLSetting(settings, tab.url || "");
  if (closeRule.idleTimeout === 0 ||
    closeRule.idleCondition !== "window") {
    return;
  }
  const clientTab = convertToClientTabInfo(tab);

  // Skip if converted tab has invalid ID
  if (!clientTab.id) {
    console.debug("[Background] Converted tab has invalid ID in onActivated:", info.tabId);
    return;
  }

  const clientTabs = await currentTabStorage.getValue();
  if (!clientTabs) {
    return;
  }
  clientTabs[String(info.tabId)] = clientTab;
  await currentTabStorage.setValue(clientTabs);
}
async function convertTabInfoServer(tab: Browser.tabs.Tab, clientInfo: ClientTabInfo): Promise<TabInfo> {
  console.log("[Background] convertTabInfoServer: Getting info for tab", tab.id, tab.url);

  if (!tab.id) {
    throw new Error("Tab ID is required for conversion");
  }

  let tabInfo: { storage: StorageInfo, scrollPosition: ScrollPosition } | null = null;
  try {
    console.log("[Background] convertTabInfoServer: Sending get-tab-info message...");
    // Add timeout to prevent infinite waiting for content script response
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Content script timeout")), 3000)
    );
    tabInfo = await Promise.race([
      sendMessage("get-tab-info", undefined, `content-script@${tab.id}`),
      timeoutPromise
    ]);
    console.log("[Background] convertTabInfoServer: Received tab info:", tabInfo);
  } catch (error) {
    console.warn("[Background] convertTabInfoServer: Failed to get tab info from content script:", error);
    tabInfo = null;
  }

  const url = tab.url ?? getDefaultNewTabUrl();
  const urlInstance = new URL(url);
  console.log("[Background] convertTabInfoServer: Getting cookies for URL:", url);

  // Use URL-based cookie retrieval to get all relevant cookies (including parent domain cookies)
  const cookies = await browser.cookies.getAll({
    url: url,
  });

  // Also try to get cookies with domain variations
  const hostname = urlInstance.hostname;
  const domainParts = hostname.split('.');
  const additionalCookies: Browser.cookies.Cookie[] = [];

  // Try parent domains (e.g., for sub.example.com, also check .example.com)
  for (let i = 1; i < domainParts.length - 1; i++) {
    const parentDomain = '.' + domainParts.slice(i).join('.');
    try {
      const parentCookies = await browser.cookies.getAll({
        domain: parentDomain,
      });
      for (const cookie of parentCookies) {
        // Avoid duplicates
        if (!cookies.some(c => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path)) {
          additionalCookies.push(cookie);
        }
      }
    } catch (e) {
      console.debug("[Background] Failed to get cookies for domain:", parentDomain, e);
    }
  }

  const allCookies = [...cookies, ...additionalCookies];
  console.log("[Background] convertTabInfoServer: Got", allCookies.length, "cookies (URL-based:", cookies.length, ", additional:", additionalCookies.length, ")");
  console.log("[Background] convertTabInfoServer: Cookie details:", allCookies.map(c => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expirationDate: c.expirationDate,
    valueLength: c.value?.length ?? 0,
  })));

  return {
    id: tab.id.toString(),
    title: tab.title ?? urlInstance.hostname,
    windowId: tab.windowId.toString(),
    tabIndex: tab.index,
    url,
    groupId: tab.groupId.toString(),
    faviconUrl: tab.favIconUrl,
    lastActiveAt: clientInfo.lastActiveAt,
    device: navigator.userAgent,
    isIncognito: tab.incognito,
    scrollPosition: tabInfo?.scrollPosition ?? { x: 0, y: 0 },
    storage: {
      session: tabInfo?.storage?.session ?? "{}",
      local: tabInfo?.storage?.local ?? "{}",
      cookies: allCookies ? JSON.stringify(allCookies) : "[]",
    },
  } satisfies TabInfo;
}
