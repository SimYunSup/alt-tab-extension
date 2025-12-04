/**
 * Message handling module
 * Handles internal and external messages
 */

import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { onMessage } from 'webext-bridge/background';
import { createLogger } from '@alt-tab/shared/logger';
import { currentTabStorage, accessTokenStorage } from '@/utils/storage';
import { convertToClientTabInfo } from '@/utils/Tab';
import { archiveTabGroup } from '@/utils/ArchivedTabGroup';
import { restoreTabWithData } from './tab-restore';
import { convertTabToServerFormat } from './tab-converter';
import type { RestoredTabInfo } from './types';

const logger = createLogger('Messaging');

/**
 * Sets up internal message handlers (webext-bridge)
 */
export function setupInternalMessageHandlers(): void {
  onMessage('refresh-tab', async (message) => {
    const { tabId } = message.data;
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab?.id) return;

      const clientTabs = await currentTabStorage.getValue();
      if (!clientTabs) return;

      if (clientTabs[String(tabId)]) {
        clientTabs[tabId] = convertToClientTabInfo(tab);
        await currentTabStorage.setValue(clientTabs);
      }
    } catch (error) {
      logger.debug('Failed to refresh tab:', tabId, error);
    }
  });

  onMessage('send-tab-group', async (message) => {
    const { tabIds, secret, salt } = message.data as { tabIds: number[]; secret: string; salt: string };

    if (!secret || !salt) {
      logger.error('Secret and salt are required for tab group archiving');
      return false;
    }

    try {
      const tabs = await Promise.all(
        tabIds.map(async (tabId) => {
          try {
            return await browser.tabs.get(tabId);
          } catch {
            return null;
          }
        })
      );

      const validTabs = tabs.filter((tab): tab is Browser.tabs.Tab => tab !== null && tab.id !== undefined);
      if (validTabs.length === 0) {
        logger.error('No valid tabs found');
        return false;
      }

      const tabInfos = await Promise.all(
        validTabs.map((tab) => convertTabToServerFormat(tab, convertToClientTabInfo(tab)))
      );

      const result = await archiveTabGroup(tabInfos, secret, salt);
      return !!result;
    } catch (error) {
      logger.error('Failed to archive tab group:', error);
      return false;
    }
  });
}

/**
 * Sets up runtime message handlers (from content scripts)
 */
export function setupRuntimeMessageHandlers(): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'open_tab' && message.url) {
      browser.tabs.create({ url: message.url })
        .then((tab) => sendResponse({ success: true, tabId: tab.id }))
        .catch((error) => sendResponse({ success: false, error: String(error) }));
      return true;
    }

    if (message.type === 'restore_tabs' && message.tabs) {
      (async () => {
        try {
          for (const tab of message.tabs) {
            await restoreTabWithData(tab);
          }
          sendResponse({ success: true, count: message.tabs.length });
        } catch (error) {
          logger.error('Failed to restore tabs:', error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true;
    }

    return false;
  });
}

/**
 * Sets up external message handlers (from web app)
 */
export function setupExternalMessageHandlers(): void {
  browser.runtime.onMessageExternal.addListener(
    (message: { type: string; tabs?: RestoredTabInfo[]; search?: string; path?: string }, _sender, sendResponse) => {
      switch (message.type) {
        case 'ping':
          sendResponse({ success: true, version: '0.0.1' });
          return true;

        case 'open_settings': {
          const settingsUrl = browser.runtime.getURL('/popup.html') + '#/page/settings';
          browser.tabs.create({ url: settingsUrl });
          sendResponse({ success: true, url: settingsUrl });
          return true;
        }

        case 'get_extension_url': {
          const baseUrl = browser.runtime.getURL('/');
          sendResponse({ success: true, url: baseUrl });
          return true;
        }

        case 'get_redirect_url': {
          const search = message.search || '';
          const redirectUrl = browser.runtime.getURL('/web/index.html') + search;
          sendResponse({ success: true, url: redirectUrl });
          return true;
        }

        case 'open_web': {
          const path = message.path || '';
          const webUrl = browser.runtime.getURL('/web/index.html') + path;
          browser.tabs.create({ url: webUrl });
          sendResponse({ success: true, url: webUrl });
          return true;
        }

        case 'restore_tabs':
          if (message.tabs) {
            (async () => {
              try {
                for (const tab of message.tabs!) {
                  await restoreTabWithData(tab);
                }
                sendResponse({ success: true, count: message.tabs!.length });
              } catch (error) {
                logger.error('Failed to restore tabs:', error);
                sendResponse({ success: false, error: String(error) });
              }
            })();
            return true;
          }
          break;
      }

      sendResponse({ success: false, error: 'Unknown message type' });
      return true;
    }
  );
}
