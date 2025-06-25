import type { Browser } from "wxt/browser";
import type { Setting } from "./Setting";

import { browser } from "wxt/browser";
import { sendMessage } from "webext-bridge/background";
import { db } from "./db";

export const TAB_KEY = "tab";
export const RECORD_TAB_KEY = "tab-record";

function getDefaultNewTabUrl() {
  return import.meta.env.BROWSER === "browser" ? "browser://newtab" : "about:newtab";
}

export async function isClosableTab(tab: Browser.tabs.Tab, setting: Setting) {
  let closeRules = setting.globalRule;
  const blockRule = setting.whitelistUrls[tab.url ?? ""];
  if (blockRule) {
    closeRules = {
      ...closeRules,
      ...blockRule,
    };
  }
  if (closeRules.unloadTabIgnore && tab.status === "unloaded") {
    return false;
  }
  if (closeRules.pinnedTabIgnore && tab.pinned) {
    return false;
  }
  if (!closeRules.playingTabIgnore && tab.audible) {
    return false;
  }
  if (closeRules.containerTabIgnore) {
    if (tab.groupId) {
      return false;
    }
    if (import.meta.env.FIREFOX) {
      try {
        const contextualId = await (browser as any).contextualIdentities.get(
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
export async function convertTabInfoServer(tab: Browser.tabs.Tab, clientInfo: ClientTabInfo): Promise<TabInfo> {
  const tabInfo = await sendMessage("get-tab-info", undefined, `content-script@${tab.id ?? 0}`);
  const url = tab.url ?? getDefaultNewTabUrl();
  const urlInstance = new URL(url);
  const cookies = await browser.cookies.getAll({
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
export function convertToClientTabInfo(tab: Browser.tabs.Tab): ClientTabInfo {
  return {
    id: tab.id?.toString() ?? '',
    title: tab.title ?? new URL(tab.url ?? getDefaultNewTabUrl()).hostname,
    url: tab.url ?? getDefaultNewTabUrl(),
    tabIndex: tab.index,
    isPinned: tab.pinned,
    isAudible: tab.audible,
    groupId: tab.groupId?.toString(),
    windowId: tab.windowId.toString(),
    faviconUrl: tab.favIconUrl,
    lastActiveAt: Date.now()
  };
}

export async function saveTabIndexedDB(tab: Browser.tabs.Tab, clientTabInfo: ClientTabInfo) {
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
  isPinned?: boolean; // 고정 탭 여부
  isAudible?: boolean; // 소리 재생 여부
  isUnloaded?: boolean; // 언로드 탭 여부
  groupId?: string; // 탭 그룹 id(browser) or 컨테이너 id(firefox)
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
