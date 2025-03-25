import type { InactiveType, TabInfo } from "@/types/data";
import type { Setting } from "./Setting";

import { sendMessage } from "webext-bridge/background";

type TabStatus = "loaded" | "unloaded";

export class Tab {
  id: number;
  lastActivityTimeStamp: number;
  tabInstance: chrome.tabs.Tab;
  url: string;
  public status: TabStatus;
  public _inactiveType: InactiveType;
  public _refreshInterval: ReturnType<typeof setInterval> | undefined;
  constructor(
    tab: chrome.tabs.Tab,
    inactiveType: InactiveType,

    refreshInterval = 1000,
  ) {
    this.id = tab.id ?? chrome.tabs.TAB_ID_NONE;
    this.tabInstance = tab;
    this.url = tab.url ?? Tab.getDefaultNewTabUrl();
    this.lastActivityTimeStamp = Date.now();
    this._inactiveType = inactiveType;
    if (tab.status === "complete") {
      this.status = "loaded";
    } else {
      this.status = "unloaded";
    }
  }
  public updateTab(tab: chrome.tabs.Tab) {
    this.id = tab.id ?? chrome.tabs.TAB_ID_NONE;
    this.tabInstance = tab;
    this.url = tab.url ?? Tab.getDefaultNewTabUrl();
    this.lastActivityTimeStamp = Date.now();
    if (tab.status === "complete") {
      this.status = "loaded";
    } else {
      this.status = "unloaded";
    }
  }
  public replaceTabId(id: number) {
    this.id = id;
  }
  public activate() {
    this.lastActivityTimeStamp = Date.now();
  }
  public static getDefaultNewTabUrl() {
    if (import.meta.env.BROWSER === "firfox") {
      return "about:newtab";
    }
    if (import.meta.env.BROWSER === "chrome") {
      return "chrome://newtab/";
    }
    if (import.meta.env.BROWSER === "edge") {
      return "edge://newtab/";
    }
    if (import.meta.env.BROWSER === "safari") {
      return "safari-newtab://";
    }
    return "about:blank";
  }

  public isClosable(setting: Setting) {
    let closeRules = setting.closeRules;
    const blockRule = setting.blocklist.find((block) => block.url === this.url);
    if (blockRule) {
      closeRules = {
        ...closeRules,
        ...blockRule.rule,
      };
    }
    if (closeRules.pinnedTabIgnore && this.tabInstance.pinned) {
      return false;
    }
    if (closeRules.mutedTabIgnore && this.tabInstance.mutedInfo?.muted) {
      return false;
    }
    if (closeRules.containerTabIgnore && this.tabInstance.groupId) {
      return false;
    }
    const now = Date.now();
    if (now - this.lastActivityTimeStamp > setting.closeRules.idleThreshold * 60 * 1000) {
      return true;
    }
    return true;
  }

  public async close(): Promise<Omit<TabInfo, "deviceId" | "userId">> {
    const tabInfo: Partial<Omit<TabInfo, "deviceId" | "userId">> = {
      id: this.id.toString(),
      windowId: this.tabInstance.windowId.toString(),
      tabIndex: this.tabInstance.index,
      title: this.tabInstance.title ?? "",
      url: this.tabInstance.url ?? Tab.getDefaultNewTabUrl(),
      faviconUrl: this.tabInstance.favIconUrl,
      isIncognito: this.tabInstance.incognito,
      lastActiveAt: this.lastActivityTimeStamp,
    };
    if (import.meta.env.BROWSER === "firefox") {
      tabInfo.groupId = (this.tabInstance as any).cookieStoreId;
    } else {
      tabInfo.groupId = this.tabInstance.groupId.toString();
    }
    tabInfo.scrollPosition = await sendMessage("get-scroll-position", { tabId: this.id });

    chrome.tabs.remove(this.id);

    return tabInfo as Omit<TabInfo, "deviceId" | "userId">;
  }
}


