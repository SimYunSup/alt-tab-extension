/**
 * Tab lifecycle management module
 * Handles tab creation, updates, and removal events
 */

import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { sendMessage } from 'webext-bridge/background';
import { createLogger } from '@alt-tab/shared/logger';
import type { Setting } from '@/types/data';
import type { ClientTabInfo } from '@/utils/Tab';
import { convertToClientTabInfo, isClosableTab, saveTabIndexedDB } from '@/utils/Tab';
import { getSetting, getURLSetting, saveSetting } from '@/utils/Setting';
import { currentTabStorage, settingStorage, accessTokenStorage } from '@/utils/storage';
import { isOAuthCallbackUrl, handleOAuthCallback, refreshTokens } from './oauth';
import type { IntervalEntry } from './types';

const logger = createLogger('TabLifecycle');

const DEFAULT_INTERVAL = 10_000;

/**
 * Adds a refresh interval for a tab based on settings
 */
export function addRefreshInterval(tab: ClientTabInfo, setting: Setting): boolean {
  if (!tab.id) {
    logger.debug('Cannot add refresh interval - tab has no id');
    return false;
  }

  const { idleCondition, idleTimeout, refreshInterval } = {
    ...setting.globalRule,
    refreshInterval: setting.refreshInterval,
  };

  if (idleCondition === 'idle' && (import.meta.env.CHROME || import.meta.env.EDGE)) {
    sendMessage('refresh-interval', {
      type: 'idle',
      tabId: Number(tab.id),
      interval: refreshInterval ?? DEFAULT_INTERVAL,
      enabled: idleTimeout > 0,
    }, `content-script@${tab.id}`);
    return true;
  }

  if (idleCondition === 'visibility') {
    sendMessage('refresh-interval', {
      type: 'visibility',
      tabId: Number(tab.id),
      interval: refreshInterval ?? DEFAULT_INTERVAL,
      enabled: idleTimeout > 0,
    }, `content-script@${tab.id}`);
    return true;
  }

  return false;
}

/**
 * Handler for tab activation (window-based idle detection)
 */
export async function onTabActivated(info: Browser.tabs.OnActivatedInfo): Promise<void> {
  let tab: Browser.tabs.Tab | undefined;
  try {
    tab = await browser.tabs.get(info.tabId);
    if (!tab?.id) return;
  } catch {
    return;
  }

  const settings = await getSetting();
  const closeRule = getURLSetting(settings, tab.url || '');

  if (closeRule.idleTimeout === 0 || closeRule.idleCondition !== 'window') {
    return;
  }

  const clientTab = convertToClientTabInfo(tab);
  if (!clientTab.id) return;

  const clientTabs = await currentTabStorage.getValue();
  if (!clientTabs) return;

  clientTabs[String(info.tabId)] = clientTab;
  await currentTabStorage.setValue(clientTabs);
}

/**
 * Sets up tab event listeners
 */
export function setupTabEventListeners(
  intervalResult: IntervalEntry[],
  updateIntervalResult: (result: IntervalEntry[]) => void
): void {
  // Tab created
  browser.tabs.onCreated.addListener(async (tab) => {
    if (!tab.id) return;

    if (isOAuthCallbackUrl(tab.url)) {
      handleOAuthCallback(tab.url!);
      try {
        await browser.tabs.remove(tab.id);
      } catch {
        // Tab might already be closed
      }
      return;
    }

    const setting = await getSetting();
    let tabs = await currentTabStorage.getValue() ?? {};
    const currentTabInfo = convertToClientTabInfo(tab);

    if (!currentTabInfo.id) return;

    tabs[currentTabInfo.id] = currentTabInfo;
    const result = addRefreshInterval(currentTabInfo, setting);

    const newResult = [...intervalResult, [currentTabInfo.id, result] as IntervalEntry];
    updateIntervalResult(newResult);

    await currentTabStorage.setValue(tabs);
  });

  // Tab updated
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.id) return;

    if (isOAuthCallbackUrl(tab.url)) {
      let tabs = await currentTabStorage.getValue();
      if (tabs?.[tabId]) {
        delete tabs[tabId];
        await currentTabStorage.setValue(tabs);
      }
      if (tab.active) {
        handleOAuthCallback(tab.url!);
        try {
          await browser.tabs.remove(tab.id);
        } catch {
          // Tab might already be closed
        }
      }
      return;
    }

    let tabs = await currentTabStorage.getValue() ?? {};
    const currentTabInfo = convertToClientTabInfo(tab);

    if (!currentTabInfo.id) return;

    tabs[tabId] = currentTabInfo;

    if (changeInfo.status === 'complete') {
      const setting = await getSetting();
      const result = addRefreshInterval(currentTabInfo, setting);

      const index = intervalResult.findIndex(([id]) => id === String(tabId));
      const newResult = [...intervalResult];
      if (index !== -1) {
        newResult[index][1] = result;
      } else {
        newResult.push([String(tabId), result]);
      }
      updateIntervalResult(newResult);
    }

    await currentTabStorage.setValue(tabs);
  });

  // Tab replaced
  browser.tabs.onReplaced.addListener(async (tabId, removedTabId) => {
    if (!tabId || !removedTabId) return;

    let tabs = await currentTabStorage.getValue() ?? {};
    const currentTabInfo = tabs[removedTabId];

    if (currentTabInfo?.id) {
      delete tabs[removedTabId];
      tabs[tabId] = currentTabInfo;

      const setting = await getSetting();
      const result = addRefreshInterval(currentTabInfo, setting);

      const newResult = [...intervalResult, [String(tabId), result] as IntervalEntry];
      updateIntervalResult(newResult);

      await currentTabStorage.setValue(tabs);
    }
  });

  // Tab removed
  browser.tabs.onRemoved.addListener(async (tabId) => {
    if (!tabId) return;

    let tabs = await currentTabStorage.getValue() ?? {};
    if (tabs[tabId]) {
      delete tabs[tabId];
      await currentTabStorage.setValue(tabs);
    }
  });
}

/**
 * Sets up settings watcher for tab closing based on idle timeout
 */
export function setupSettingsWatcher(): void {
  settingStorage.watch(async (setting) => {
    if (!setting) return;

    const tabs = await currentTabStorage.getValue();
    if (!tabs) return;

    for (const [tabId, tabInfo] of Object.entries(tabs)) {
      const closeRule = Object.entries(setting.whitelistUrls).find(
        ([url]) => tabInfo.url.startsWith(url)
      )?.[1] ?? setting.globalRule;

      const isOutdatedTab = closeRule.idleTimeout > 0 &&
        tabInfo.lastActiveAt < Date.now() - 1000 * 60 * closeRule.idleTimeout;

      try {
        const tab = await browser.tabs.get(Number(tabId));
        if (!tab?.id) continue;

        if (isOutdatedTab && await isClosableTab(tab, setting)) {
          await Promise.all([
            browser.tabs.remove(tab.id),
            saveTabIndexedDB(tab, tabInfo),
          ]);
        }
      } catch {
        continue;
      }
    }

    const token = await accessTokenStorage.getValue();
    if (token) {
      await saveSetting(setting, token);
    }
  });
}

/**
 * Initializes tabs on startup
 */
export async function initializeTabs(
  updateIntervalResult: (result: IntervalEntry[]) => void
): Promise<() => void> {
  const tabs = await browser.tabs.query({});
  const setting = await getSetting();

  const clientTabArray = tabs
    .map(convertToClientTabInfo)
    .filter((tab) => tab.id && !isOAuthCallbackUrl(tab.url));

  await currentTabStorage.setValue(
    Object.fromEntries(clientTabArray.map((tab) => [tab.id, tab]))
  );

  // Setup window-based idle detection
  if (setting.globalRule.idleCondition === 'window') {
    browser.tabs.onActivated.addListener(onTabActivated);
  } else {
    browser.tabs.onActivated.removeListener(onTabActivated);
  }

  // Setup refresh intervals for all tabs
  const newIntervalResult: IntervalEntry[] = clientTabArray.map((tab) => {
    const success = addRefreshInterval(tab, setting);
    return [tab.id, success] as const;
  });
  updateIntervalResult(newIntervalResult);

  // Shared interval for window-based detection
  const sharedIntervalId = setInterval(async () => {
    const currentSetting = await getSetting();
    if (currentSetting.globalRule.idleCondition !== 'window') return;

    const activeTabs = await browser.tabs.query({ active: true });
    const clientTabs = await currentTabStorage.getValue();
    if (!clientTabs) return;

    for (const activeTab of activeTabs) {
      if (!activeTab.id) continue;

      const tabInfo = clientTabs[String(activeTab.id)];
      if (tabInfo) {
        const currentTabInfo = convertToClientTabInfo(activeTab);
        if (currentTabInfo.id) {
          clientTabs[activeTab.id] = currentTabInfo;
        }
      }
    }

    await currentTabStorage.setValue(clientTabs);
  }, DEFAULT_INTERVAL);

  // Return cleanup function
  return () => {
    clearInterval(sharedIntervalId);
  };
}
