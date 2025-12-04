/**
 * Tab conversion module
 * Converts browser tabs to server-compatible format with storage data
 */

import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { sendMessage } from 'webext-bridge/background';
import { createLogger } from '@alt-tab/shared/logger';
import type { ClientTabInfo, TabInfo, StorageInfo, ScrollPosition } from '@/utils/Tab';
import { getDefaultNewTabUrl } from '@/utils/Tab';

const logger = createLogger('TabConverter');

const CONTENT_SCRIPT_TIMEOUT_MS = 3000;

async function getTabInfoFromContentScript(
  tabId: number
): Promise<{ storage: StorageInfo; scrollPosition: ScrollPosition } | null> {
  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Content script timeout')), CONTENT_SCRIPT_TIMEOUT_MS)
    );

    const tabInfo = await Promise.race([
      sendMessage('get-tab-info', undefined, `content-script@${tabId}`),
      timeoutPromise,
    ]);

    return tabInfo;
  } catch (error) {
    logger.warn('Failed to get tab info from content script:', error);
    return null;
  }
}

async function getCookiesForUrl(url: string): Promise<Browser.cookies.Cookie[]> {
  const urlInstance = new URL(url);
  const hostname = urlInstance.hostname;
  const cookies = await browser.cookies.getAll({ url });

  const domainParts = hostname.split('.');
  const additionalCookies: Browser.cookies.Cookie[] = [];

  for (let i = 1; i < domainParts.length - 1; i++) {
    const parentDomain = '.' + domainParts.slice(i).join('.');
    try {
      const parentCookies = await browser.cookies.getAll({ domain: parentDomain });
      for (const cookie of parentCookies) {
        const isDuplicate = cookies.some(
          c => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
        );
        if (!isDuplicate) {
          additionalCookies.push(cookie);
        }
      }
    } catch {
      // Ignore errors for parent domain cookies
    }
  }

  return [...cookies, ...additionalCookies];
}

/**
 * Converts a browser tab to server-compatible TabInfo format
 */
export async function convertTabToServerFormat(
  tab: Browser.tabs.Tab,
  clientInfo: ClientTabInfo
): Promise<TabInfo> {
  if (!tab.id) {
    throw new Error('Tab ID is required for conversion');
  }

  const tabInfo = await getTabInfoFromContentScript(tab.id);
  const url = tab.url ?? getDefaultNewTabUrl();
  const urlInstance = new URL(url);
  const cookies = await getCookiesForUrl(url);

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
      session: tabInfo?.storage?.session ?? '{}',
      local: tabInfo?.storage?.local ?? '{}',
      cookies: JSON.stringify(cookies),
    },
  };
}
