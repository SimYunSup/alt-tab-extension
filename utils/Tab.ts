import type { Setting } from "./Setting";
import { sendMessage } from "webext-bridge/background";
import { db } from "./db";

type TabStatus = "loaded" | "unloaded";
export const TAB_KEY = "tab";
export const RECORD_TAB_KEY = "tab-record";

function getDefaultNewTabUrl() {
  return import.meta.env.BROWSER === "chrome" ? "chrome://newtab" : "about:newtab";
}

export async function isClosableTab(tab: chrome.tabs.Tab, setting: Setting) {
  let closeRules = setting.closeRules;
  const blockRule = setting.blocklist.find((block) => block.url === tab.url);
  if (blockRule) {
    closeRules = {
      ...closeRules,
      ...blockRule.rule,
    };
  }
  if (closeRules.pinnedTabIgnore && tab.pinned) {
    return false;
  }
  if (closeRules.mutedTabIgnore && tab.mutedInfo?.muted) {
    return false;
  }
  if (closeRules.containerTabIgnore) {
    if (tab.groupId) {
      return false;
    }
    if (import.meta.env.FIREFOX) {
      try {
        const contextualId = await browser.contextualIdentities.get(
          (tab as any).cookieStoreId
        );
        return false;
      } catch {
        return true;
      }
    }
  }
  return true;
}

// use this function only in background
export async function convertTabInfoServer(tab: chrome.tabs.Tab, clientInfo: ClientTabInfo): Promise<TabInfo> {
  const tabInfo = await sendMessage("get-tab-info", undefined, `content-script@${tab.id ?? 0}`);
  const url = tab.url ?? getDefaultNewTabUrl();
  const urlInstance = new URL(url);
  const cookies = await chrome.cookies.getAll({
    url: url,
  });
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
    storge: {
      ...tabInfo?.storage,
      cookies: cookies ? JSON.stringify(cookies) : undefined,
    },
  } satisfies TabInfo;
}
export function convertToClientTabInfo(tab: chrome.tabs.Tab): ClientTabInfo {
  return {
    id: tab.id?.toString() ?? '',
    title: tab.title ?? new URL(tab.url ?? getDefaultNewTabUrl()).hostname,
    url: tab.url ?? getDefaultNewTabUrl(),
    tabIndex: tab.index,
    groupId: tab.groupId?.toString(),
    windowId: tab.windowId.toString(),
    faviconUrl: tab.favIconUrl,
    lastActiveAt: Date.now()
  };
}

export async function saveTabIndexedDB(tab: chrome.tabs.Tab, clientTabInfo: ClientTabInfo) {
  const url = tab.url ?? getDefaultNewTabUrl();
  const urlInstance = new URL(url);
  const tabInfo = {
    id: crypto.randomUUID(),
    url: url,
    title: tab.title ?? urlInstance.hostname,
    windowId: tab.windowId,
    tabIndex: tab.index,
    lastActiveAt: clientTabInfo.lastActiveAt,
    faviconUrl: tab.favIconUrl,
  } satisfies RecordTabInfo;
  await db.recordTabs.add(tabInfo);
  return;
}

export interface ClientTabInfo {
  id: string;
  title: string;
  url: string;
  tabIndex: number; // 탭 순서
  groupId?: string; // 탭 그룹 id(chrome) or 컨테이너 id(firefox)
  windowId: string; // 윈도 id
  faviconUrl?: string; // 저장된 favicon url
  lastActiveAt: number;
}

export interface RecordTabInfo {
  id: string;
  url: string;
  title?: string;
  windowId: number;
  tabIndex?: number;
  lastActiveAt: number;
  faviconUrl?: string;
}

export interface TabInfo extends ClientTabInfo {
  device: string;
  isIncognito: boolean;
  scrollPosition?: ScrollPosition;
  storge?: StorageInfo;
}
export interface StorageInfo {
  session?: string;
  cookies?: string;
  local?: string;
}

export interface ScrollPosition {
  x: number;
  y: number;
}
