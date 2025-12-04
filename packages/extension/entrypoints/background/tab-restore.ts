/**
 * Tab restoration module
 * Handles restoring tabs with their associated data (cookies, storage, scroll position)
 */

import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { sendMessage } from 'webext-bridge/background';
import { createLogger } from '@alt-tab/shared/logger';
import type { RestoredTabInfo } from './types';

const logger = createLogger('TabRestore');

/**
 * Waits for a tab to finish loading
 */
async function waitForTabLoad(tabId: number, timeoutMs = 5000): Promise<void> {
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
        resolved = true;
        resolve();
      }
    };

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logger.debug('Tab load timeout, continuing anyway');
        resolve();
      }
    }, timeoutMs);

    checkTab();
  });
}

/**
 * Restores cookies for a URL before opening the tab
 */
async function restoreCookies(tabInfo: RestoredTabInfo): Promise<void> {
  if (!tabInfo.cookie) return;

  try {
    const cookies = JSON.parse(tabInfo.cookie) as Browser.cookies.SetDetails[];
    logger.debug(`Restoring ${cookies.length} cookies for ${tabInfo.url}`);

    for (const cookie of cookies) {
      try {
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
      } catch (cookieError) {
        logger.warn(`Failed to set cookie: ${cookie.name}`, cookieError);
      }
    }
  } catch (error) {
    logger.error('Failed to parse cookies:', error);
  }
}

/**
 * Sends storage data to a tab's content script for restoration
 */
async function restoreStorageData(tabId: number, tabInfo: RestoredTabInfo): Promise<void> {
  if (!tabInfo.session && !tabInfo.local && !tabInfo.scrollPosition) return;

  try {
    await sendMessage(
      'restore-storage',
      {
        session: tabInfo.session || '{}',
        local: tabInfo.local || '{}',
        scrollPosition: tabInfo.scrollPosition || { x: 0, y: 0 },
      },
      `content-script@${tabId}`
    );
    logger.debug(`Storage restoration message sent to tab: ${tabId}`);
  } catch (error) {
    logger.warn('Failed to send storage data to content script:', error);
  }
}

/**
 * Restores a tab with its associated data
 */
export async function restoreTabWithData(tabInfo: RestoredTabInfo): Promise<void> {
  logger.info(`Restoring tab: ${tabInfo.url}`);

  await restoreCookies(tabInfo);

  const newTab = await browser.tabs.create({
    url: tabInfo.url,
    active: false,
  });

  if (!newTab.id) {
    logger.error('Failed to create tab - no ID returned');
    return;
  }

  logger.debug(`Tab created with ID: ${newTab.id}`);

  if (tabInfo.session || tabInfo.local || tabInfo.scrollPosition) {
    await waitForTabLoad(newTab.id);
    await restoreStorageData(newTab.id, tabInfo);
  }
}
