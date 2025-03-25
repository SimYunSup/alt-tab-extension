import type { Setting } from "@/utils/Setting";

import { storage } from "wxt/storage";
import { Tab } from "@/utils/Tab";
import { SETTING_KEY } from "@/utils/Setting";
import { onMessage, sendMessage } from "webext-bridge/background";
import { ClientTabInfo } from "@/types/data";

export default defineBackground(() => {
  async function init() {
    const _setting = await storage.getItem<Setting>(`local:${SETTING_KEY}`);
    if (!_setting) {
      await storage.setItem<Setting>(`local:${SETTING_KEY}`, DEFAULT_SETTING);
    }
    const setting = _setting ?? DEFAULT_SETTING;
    const query = await chrome.tabs.query({});
    const intervalIds: ReturnType<typeof setInterval>[] = [];
    const inactiveType = "window";
    const basedTabs = query.map((tab) => {
      const tabInstance = new Tab(tab, inactiveType);
      return tabInstance;
    });
    const tabs = createObservableArray(
      basedTabs,
      ["lastActivityTimeStamp", "url"],
      (change) => {
        // console.log(change.map((tab) => (new Date(tab.lastActivityTimeStamp).toLocaleString())));
        const deactivatedTabs = change.filter((tab) => {
          const blocklist = setting.blocklist.find((block) => tab.url.startsWith(block.url));
          if (blocklist) {
            return blocklist.rule.idleThreshold > 0 && tab.lastActivityTimeStamp < Date.now() - 1000 * 60 * blocklist.rule.idleThreshold;
          }
          return setting.closeRules.idleThreshold > 0 && tab.lastActivityTimeStamp < Date.now() - 1000 * 60 * setting.closeRules.idleThreshold;
        });
        deactivatedTabs.forEach((tab) => {
          if (tab.isClosable(setting)) {
            chrome.tabs.remove(tab.tabInstance.id!);
          }
        });
        const changedTabs = change.filter((tab) => !deactivatedTabs.includes(tab));
        sendMessage("tab-update", normalizeTabs(changedTabs), "popup");
      }
    )
    tabs.forEach((tab) => addRefreshInterval(tab, setting));
    onMessage("get-current-tabs", () => {
      return normalizeTabs(tabs);
    });

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === "popup-tabs") {
        sendMessage("tab-update", normalizeTabs(tabs), "popup");
      }
    })
    chrome.tabs.onCreated.addListener((tab) => {
      if (!tab.id) {
        return;
      }
      const tabInstance = new Tab(tab, inactiveType);
      tabs.push(tabInstance);
      sendMessage("tab-update", normalizeTabs(tabs), "popup");
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!tabId) {
        return;
      }
      const tabInstance = tabs.find((tab) => tab.tabInstance.id === tabId);
      if (!tabInstance) {
        if (!tab.id) {
          return;
        }
        const inactiveType = "window";
        const tabInstance = new Tab(tab, inactiveType);
        addRefreshInterval(tabInstance, setting);
        tabs.push(tabInstance);
        sendMessage("tab-update", normalizeTabs(tabs), "popup");
        return;
      }
      tabInstance.updateTab(tab);
      sendMessage("tab-update", normalizeTabs(tabs), "popup");
    });
    chrome.tabs.onReplaced.addListener((tabId, removedTabId) => {
      const removedTab = tabs.find((tab) => tab.tabInstance.id === removedTabId);
      if (!removedTab) {
        return;
      }
      removedTab.replaceTabId(tabId);
      sendMessage("tab-update", normalizeTabs(tabs), "popup");
    })
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (!tabId) {
        return;
      }
      const index = tabs.findIndex((tab) => tab.tabInstance.id === tabId);
      if (index !== -1) {
        tabs.splice(index, 1);
      }
      sendMessage("tab-update", normalizeTabs(tabs), "popup");
    });
  }
  init();
});

function addRefreshInterval(tab: Tab, setting: Setting) {
  if (setting.closeRules.idleCondition === "idle") {
    sendMessage("refresh-interval", {
      type: "idle",
      tabId: tab.tabInstance.id ?? 0,
      interval: setting.refreshInterval,
    }, "contentScript");
  } else if (setting.closeRules.idleCondition === "window") {
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
    }, "contentScript");
  }
}

function normalizeTabs(tabs: Tab[]): Record<string, ClientTabInfo> {
  return Object.fromEntries(tabs.map(((tab) => (
    [tab.tabInstance.id,
    {
      id: tab.tabInstance.id,
      title: tab.tabInstance.title,
      windowId: tab.tabInstance.windowId.toString(),
      tabIndex: tab.tabInstance.index,
      url: tab.tabInstance.url,
      faviconUrl: tab.tabInstance.favIconUrl,
      lastActiveAt: tab.lastActivityTimeStamp,
    }
    ]
  ))));
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