import type { ClientTabInfo } from "@/utils/Tab";
import type { Setting } from "@/utils/Setting";

import { browser } from 'wxt/browser';
import { defineBackground } from "#imports";
import { onMessage, sendMessage } from "webext-bridge/background";
import { convertToClientTabInfo, saveTabIndexedDB } from "@/utils/Tab";
import { isClosableTab } from "@/utils/Tab";
import { getSetting } from "@/utils/Setting";
import { currentTabStorage, settingStorage, accessTokenStorage, refreshTokenStorage } from "@/utils/storage";


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
    browser.runtime.onStartup.addListener(async () => {
      await initTab();
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
    }
    browser.tabs.onCreated.addListener(async (tab) => {
      if (!tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL)) {
        return;
      }
      detectOauthFlow(tab.url);
      await browser.tabs.remove(tab.id!);
    });
    browser.tabs.onUpdated.addListener(async (_, __, tab) => {
      if (!tab.url?.includes(import.meta.env.VITE_OAUTH_BASE_URL) || !tab.active) {
        return;
      }
      detectOauthFlow(tab.url);
      await browser.tabs.remove(tab.id!);
    });

    // Tab event
    browser.tabs.onCreated.addListener(async (tab) => {
      if (!tab.id) {
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
          const closeRule = setting.blocklist.find((block) => tabInfo.url.startsWith(block.url))?.rule
            ?? setting.closeRules;
          const isOutdatedTab = closeRule.idleThreshold > 0 && tabInfo.lastActiveAt < Date.now() - 1000 * 60 * closeRule.idleThreshold;
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
      })
    async function initTab() {
      const tabs = await browser.tabs.query({});
      const setting = await getSetting();
      const clientTabArray = tabs.map((tab) => convertToClientTabInfo(tab));
      await currentTabStorage.setValue(Object.fromEntries(clientTabArray.map((tab) => [tab.id, tab])));
      if (setting.closeRules.idleCondition === "window") {
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
        if (setting.closeRules.idleCondition !== "window") {
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
    if (setting.closeRules.idleCondition === "idle" && (
      import.meta.env.CHROME ||
      import.meta.env.EDGE
    )) {
      sendMessage("refresh-interval", {
        type: "idle",
        tabId: Number(tab.id),
        interval: setting.refreshInterval ?? DEFAULT_INTERVAL,
        enabled: setting.closeRules.idleThreshold > 0,
      }, `content-script@${tab.id ?? 0}`);
      return true;
    } else if (setting.closeRules.idleCondition === "visibility") {
      sendMessage("refresh-interval", {
        type: "visibility",
        tabId: Number(tab.id),
        interval: setting.refreshInterval ?? DEFAULT_INTERVAL,
        enabled: setting.closeRules.idleThreshold > 0,
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
  init();
});

async function onActivated(info: chrome.tabs.TabActiveInfo) {
  const tab = await browser.tabs.get(info.tabId);
  const settings = await getSetting();
  const closeRule = settings?.blocklist.find((block) => tab.url?.startsWith(block.url))?.rule
    ?? settings.closeRules;
  if (closeRule.idleThreshold === 0 ||
    closeRule.idleCondition !== "window") {
    return;
  }
  const clientTab = convertToClientTabInfo(tab);
  const clientTabs = await currentTabStorage.getValue();
  clientTabs[String(info.tabId)] = clientTab;
  await currentTabStorage.setValue(clientTabs);
}
