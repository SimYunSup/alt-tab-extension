import type { Setting } from "@/utils/Setting";
import type { ClientTabInfo, TabInfo } from "@/types/data";

import { storage } from "wxt/storage";
import { onMessage, sendMessage } from "webext-bridge/background";
import { Tab } from "@/utils/Tab";
import { getSetting, getURLSetting } from "@/utils/Setting";


export default defineBackground(() => {
  async function init() {
    const setting = await getSetting();
    const deactivatedTabs = await resetDeactivatedTabs();
    let tabs = await resetTabInstance(deactivatedTabs, setting);
    storage.watch<Setting>(`local:${SETTING_KEY}`, async (setting) => {
      if (!setting) {
        return;
      }
      tabs = await resetTabInstance(deactivatedTabs, setting);
    });
    chrome.tabs.onCreated.addListener(async (tab) => {
      if (!tab.id) {
        return;
      }
      const setting = await getSetting();
      const inactiveType = getURLSetting(setting, tab.url ?? "").idleCondition;
      const tabInstance = new Tab(tab, inactiveType);
      tabs.push(tabInstance);
      sendMessage("tab-update", normalizeTabs(tabs, setting), "popup");
    });
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (!tabId) {
        return;
      }
      const setting = await getSetting();
      const tabInstance = tabs.find((tab) => tab.tabInstance.id === tabId);
      if (!tabInstance) {
        if (!tab.id) {
          return;
        }
        const inactiveType = getURLSetting(setting, tab.url ?? "").idleCondition;
        const tabInstance = new Tab(tab, inactiveType);
        addRefreshInterval(tabInstance, setting);
        tabs.push(tabInstance);
        sendMessage("tab-update", normalizeTabs(tabs, setting), "popup");
        return;
      }
      tabInstance.updateTab(tab);
      sendMessage("tab-update", normalizeTabs(tabs, setting), "popup");
    });
    chrome.tabs.onReplaced.addListener(async (tabId, removedTabId) => {
      const removedTab = tabs.find((tab) => tab.tabInstance.id === removedTabId);
      if (!removedTab) {
        return;
      }
      const setting = await getSetting();
      removedTab.replaceTabId(tabId);
      sendMessage("tab-update", normalizeTabs(tabs, setting), "popup");
    })
    chrome.tabs.onRemoved.addListener(async (tabId) => {
      if (!tabId) {
        return;
      }
      const index = tabs.findIndex((tab) => tab.tabInstance.id === tabId);
      if (index !== -1) {
        tabs.splice(index, 1);
      }
      const setting = await getSetting();
      sendMessage("tab-update", normalizeTabs(tabs, setting), "popup");
    });
  }

async function normalizeRecordTab(tab: Tab){
  const tabInfo = await sendMessage("get-tab-info", undefined, `content-script${tab.tabInstance.id ?? 0}`);
  return {
    id: tab.tabInstance.id!.toString(),
    title: tab.tabInstance.title ?? tab.tabInstance.url!,
    windowId: tab.tabInstance.windowId.toString(),
    tabIndex: tab.tabInstance.index,
    url: tab.tabInstance.url!,
    groupId: tab.tabInstance.groupId.toString(),
    faviconUrl: tab.tabInstance.favIconUrl,
    lastActiveAt: tab.lastActivityTimeStamp,
    device: navigator.userAgent,
    isIncognito: tab.tabInstance.incognito,
    scrollPosition: tabInfo?.scrollPosition,
    storge: tabInfo?.storage,
  } satisfies TabInfo;
}
async function resetDeactivatedTabs() {
  const set = new Set<TabInfo | Tab>();
  return new Proxy(set, {
    get(target, prop, receiver) {
      if (prop === "add") {
        return async (tab: Tab) => {
          const recordTab = await normalizeRecordTab(tab);
          target.add(recordTab);
          sendMessage("record-tab-update", Array.from(target as Set<TabInfo>), "popup");
          setTimeout(() => {
            chrome.tabs.remove(tab.tabInstance.id!);
          }, 0);
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Set<Tab>;
}
type DeactivatedTabs = Awaited<ReturnType<typeof resetDeactivatedTabs>>;

async function resetTabInstance(_deactivatedTabs: DeactivatedTabs, setting: Setting) {
  const query = await chrome.tabs.query({});
  const basedTabs = query.map((tab) => {
    const inactiveType = getURLSetting(setting, tab.url ?? "").idleCondition;
    const tabInstance = new Tab(tab, inactiveType);
    return tabInstance;
  });

  const tabs = createObservableArray(
    basedTabs,
    ["lastActivityTimeStamp", "url"],
    (change) => {
      const deactivatedTabs = change.filter((tab) => {
        const blocklist = setting.blocklist.find((block) => tab.url.startsWith(block.url));
        if (blocklist) {
          return blocklist.rule.idleThreshold > 0 && tab.lastActivityTimeStamp < Date.now() - 1000 * 60 * blocklist.rule.idleThreshold;
        }
        return setting.closeRules.idleThreshold > 0 && tab.lastActivityTimeStamp < Date.now() - 1000 * 60 * setting.closeRules.idleThreshold;
      });
      deactivatedTabs.forEach((tab) => {
        if (tab.isClosable(setting)) {
          _deactivatedTabs.add(tab);
        }
      });
      const changedTabs = change.filter((tab) => !deactivatedTabs.includes(tab));
      sendMessage("tab-update", normalizeTabs(changedTabs, setting), "popup");
    }
  )
  tabs.forEach((tab) => addRefreshInterval(tab, setting));
  onMessage("get-current-tabs", async () => {
    const setting = await getSetting();
    return normalizeTabs(tabs, setting);
  });

  return tabs;
}
  init();
});


function addRefreshInterval(tab: Tab, setting: Setting) {
  if (setting.closeRules.idleCondition === "idle") {
    sendMessage("refresh-interval", {
      type: "idle",
      tabId: tab.tabInstance.id ?? 0,
      interval: setting.refreshInterval,
    }, `content-script${tab.tabInstance.id ?? 0}`);
  } else if (setting.closeRules.idleCondition === "window") {
    if (!tab.lastActivityTimeStamp) {
      return;
    }
    const intervalId = setInterval(() => {
      async function checkActive() {
        const activeInfo = await chrome.tabs.get(Number(tab.tabInstance.id));
        if (activeInfo.active) {
          tab.lastActivityTimeStamp = Date.now();
        } else {
          clearInterval(intervalId);
        }
      }
      checkActive();
    }, setting.refreshInterval);
    return () => clearInterval(intervalId);
  } else if (setting.closeRules.idleCondition === "visiblity") {
    sendMessage("refresh-interval", {
      type: "visiblity",
      tabId: tab.tabInstance.id ?? 0,
      interval: setting.refreshInterval,
    }, `content-script${tab.tabInstance.id ?? 0}`);
  }
}

function normalizeTabs(tabs: Tab[], setting: Setting): Record<string, ClientTabInfo> {
  return Object.fromEntries(tabs.map(((tab) => {
    const currentRules = setting.blocklist.find((block) => tab.url.startsWith(block.url))?.rule ?? setting.closeRules;
    const isLocked = currentRules.idleThreshold === 0
      || (tab.tabInstance.pinned && currentRules.pinnedTabIgnore)
      || (tab.tabInstance.mutedInfo?.muted && currentRules.mutedTabIgnore);
    return [
      tab.tabInstance.id,
      {
        id: tab.tabInstance.id,
        title: tab.tabInstance.title,
        windowId: tab.tabInstance.windowId.toString(),
        tabIndex: tab.tabInstance.index,
        url: tab.tabInstance.url,
        faviconUrl: tab.tabInstance.favIconUrl,
        lastActiveAt: isLocked ? -1 : tab.lastActivityTimeStamp,
      }
    ]
  })));
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  } as T;
}

function createObservableArray<T extends object>(
  initialArray: T[],
  property: (keyof T)[],
  callback: (change: T[]) => void,
  debounceDelay = 300
): T[] {
  const array = [...initialArray];
  const debouncedCallback = debounce(() => callback(array), debounceDelay);
  return array.map((item, index) => wrapInstance(item, property, debouncedCallback));
}

function wrapInstance<T extends object>(
  instance: T,
  property: (keyof T)[],
  callback: () => void
): T {
  return new Proxy(instance, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      if (property.includes(prop as keyof T)) {
        const oldValue = target[prop as keyof T];
        const result = Reflect.set(target, prop, value, receiver);
        if (oldValue !== value) {
          callback();
        }
        return result;
      }
      return Reflect.set(target, prop, value, receiver);
    }
  });
}
