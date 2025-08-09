import type { Browser } from "wxt/browser";
import type { ClientTabInfo, TabInfo } from "@/utils/Tab";
import type { Setting } from "@/types/data";

import { browser } from 'wxt/browser';
import { defineBackground } from "#imports";
import { onMessage, sendMessage } from "webext-bridge/background";
import { convertToClientTabInfo, getDefaultNewTabUrl, saveTabIndexedDB } from "@/utils/Tab";
import { isClosableTab } from "@/utils/Tab";
import { getSetting, getURLSetting, initSettingIfLogin, saveSetting } from "@/utils/Setting";
import { currentTabStorage, settingStorage, accessTokenStorage, refreshTokenStorage } from "@/utils/storage";
import { archiveTabGroup } from "@/utils/ArchivedTabGroup";


const DEFAULT_INTERVAL = 10_000;

export default defineBackground(() => {
  let intervalResult: [string, boolean][] = [];
  async function init() {
    let listClearInterval: () => void = () => { };
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
    browser.tabs.onCreated.addListener(async (tab) => {
      if (!tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL)) {
        return;
      }
      const tokens = detectOauthFlow(tab.url);
      try {
        await browser.tabs.remove(tab.id!);
      } catch (error) {
        console.debug("Failed to remove tab", error);
      }
      void refreshTokens(tokens?.accessToken, tokens?.refreshToken);
    });
    browser.tabs.onUpdated.addListener(async (_, __, tab) => {
      if (!tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL) || !tab.active) {
        return;
      }
      detectOauthFlow(tab.url);
      try {
        await browser.tabs.remove(tab.id!);
      } catch (error) {
        console.debug("Failed to remove tab", error);
      }
    });

    // Tab event
    browser.tabs.onCreated.addListener(async (tab) => {
      if (!tab.id) {
        return;
      }
      if (tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL)) {
        return;
      }
      const setting = await getSetting();
      let tabs = await currentTabStorage.getValue();
      tabs = tabs ?? {};
      const currentTabInfo = convertToClientTabInfo(tab);

      tabs[currentTabInfo.id] = currentTabInfo;
      const result = addRefreshInterval(currentTabInfo, setting);
      intervalResult.push([currentTabInfo.id, result]);
      await currentTabStorage.setValue(tabs);
    });
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      let tabs = await currentTabStorage.getValue();
      tabs = tabs ?? {};
      const currentTabInfo = convertToClientTabInfo(tab);
      if (!currentTabInfo.id) {
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
      if (currentTabInfo) {
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
            if (isOutdatedTab && await isClosableTab(tab, setting)) {
              await Promise.all([
                browser.tabs.remove(tab.id!),
                saveTabIndexedDB(tab, tabInfo)
              ]);
            }
          } catch (error) {
            console.log("tab is closed", error);
            return;
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
        .filter((tab) => !tab.url.includes(import.meta.env.VITE_OAUTH_BASE_URL));
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
        for (const activeTab of activeTabs) {
          const tabInfo = clientTabs?.[String(activeTab.id!)];
          if (tabInfo) {
            const currentTabInfo = convertToClientTabInfo(activeTab);
            clientTabs[activeTab.id!] = currentTabInfo;
          }
        }
        await currentTabStorage.setValue(clientTabs);
      }, DEFAULT_INTERVAL);

      listClearInterval = () => {
        Promise.all(intervalResult.map(([tabId, isContentScript]) => {
          if (isContentScript) {
            sendMessage("refresh-interval", {
              type: "idle", // whatever
              tabId: Number(tabId),
              interval: DEFAULT_INTERVAL,
              enabled: false,
            });
          }
        }));
        clearInterval(sharedIntervalId);
      };
    }
  }

  function addRefreshInterval(tab: ClientTabInfo, setting: Setting) {
    if (setting.globalRule.idleCondition === "idle" && (
      import.meta.env.CHROME ||
      import.meta.env.EDGE
    )) {
      sendMessage("refresh-interval", {
        type: "idle",
        tabId: Number(tab.id),
        interval: setting.refreshInterval ?? DEFAULT_INTERVAL,
        enabled: setting.globalRule.idleTimeout > 0,
      }, `content-script@${tab.id ?? 0}`);
      return true;
    } else if (setting.globalRule.idleCondition === "visibility") {
      sendMessage("refresh-interval", {
        type: "visibility",
        tabId: Number(tab.id),
        interval: setting.refreshInterval ?? DEFAULT_INTERVAL,
        enabled: setting.globalRule.idleTimeout > 0,
      }, `content-script@${tab.id ?? 0}`);
      return true;
    }
    return false;
  }
  onMessage("refresh-tab", async (message) => {
    const { tabId } = message.data;
    const tab = await browser.tabs.get(tabId);
    const clientTabs = await currentTabStorage.getValue();
    const tabInfo = clientTabs?.[String(tabId)];
    if (tabInfo) {
      const currentTabInfo = convertToClientTabInfo(tab);
      clientTabs[tabId] = currentTabInfo;
    }
    await currentTabStorage.setValue(clientTabs);
  });
  onMessage("send-tab-group", async (message) => {
    const { tabIds } = message.data;
    try {
      const tabs = await Promise.all(tabIds.map((tabId) => browser.tabs.get(tabId)));
      const tabInfos = await Promise.all(tabs.map((tab) => convertTabInfoServer(tab, convertToClientTabInfo(tab))));
      console.log("Archiving tab group", tabInfos);
      await archiveTabGroup(tabInfos);
      return true;
    } catch (error) {
      console.error("Failed to archive tab group", error);
      return false;
    }
  });
  init();
});

async function onActivated(info: chrome.tabs.TabActiveInfo) {
  let tab: chrome.tabs.Tab | undefined;
  try {
    tab = await browser.tabs.get(info.tabId);
  } catch (error) {
    console.log("Failed to get tab", error);
    return;
  }
  const settings = await getSetting();
  const closeRule = getURLSetting(settings, tab.url || "");
  if (closeRule.idleTimeout === 0 ||
    closeRule.idleCondition !== "window") {
    return;
  }
  const clientTab = convertToClientTabInfo(tab);
  const clientTabs = await currentTabStorage.getValue();
  clientTabs[String(info.tabId)] = clientTab;
  await currentTabStorage.setValue(clientTabs);
}
async function convertTabInfoServer(tab: Browser.tabs.Tab, clientInfo: ClientTabInfo): Promise<TabInfo> {
  const tabInfo = await sendMessage("get-tab-info", undefined, `content-script@${tab.id ?? 0}`);
  const url = tab.url ?? getDefaultNewTabUrl();
  const urlInstance = new URL(url);
  const cookies = await browser.cookies.getAll({
    domain: urlInstance.hostname,
  });
  console.log("Cookies for tab", cookies);

  return {
    id: tab.id!.toString(),
    title: tab.title ?? urlInstance.hostname,
    windowId: tab.windowId.toString(),
    tabIndex: tab.index,
    url,
    groupId: tab.groupId.toString(),
    faviconUrl: tab.favIconUrl,
    lastActiveAt: clientInfo.lastActiveAt,
    device: navigator.userAgent,
    isIncognito: tab.incognito,
    scrollPosition: tabInfo?.scrollPosition,
    storage: {
      ...tabInfo?.storage,
      cookies: cookies ? JSON.stringify(cookies) : undefined,
    },
  } satisfies TabInfo;
}
