/**
 * Message handling module
 * Handles internal, runtime, and external messages
 */

import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { onMessage } from 'webext-bridge/background';
import { createLogger } from '@alt-tab/shared/logger';
import { currentTabStorage } from '@/utils/storage';
import { convertToClientTabInfo } from '@/utils/Tab';
import { archiveTabGroup } from '@/utils/ArchivedTabGroup';
import { BRIDGE_MESSAGES, RUNTIME_MESSAGES, EXTERNAL_MESSAGES } from '@/utils/message-types';
import { successResponse, errorResponse, createAsyncHandler } from '@/utils/message-response';
import { handleRestoreTabs } from './handlers/restore-tabs-handler';
import { convertTabToServerFormat } from './tab-converter';
import type { RuntimeMessage, ExternalMessage } from './types';

const logger = createLogger('Messaging');
const EXTENSION_VERSION = '0.0.1';

// ========== Internal Message Handlers (webext-bridge) ==========

/**
 * Sets up internal message handlers (webext-bridge)
 */
export function setupInternalMessageHandlers(): void {
  onMessage(BRIDGE_MESSAGES.REFRESH_TAB, async (message) => {
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

  onMessage(BRIDGE_MESSAGES.SEND_TAB_GROUP, async (message) => {
    const { tabIds, secret, salt } = message.data as { tabIds: number[]; secret: string; salt: string };

    if (!secret || !salt) {
      throw new Error('Secret and salt are required for tab group archiving');
    }

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
      throw new Error('No valid tabs found');
    }

    const tabInfos = await Promise.all(
      validTabs.map((tab) => convertTabToServerFormat(tab, convertToClientTabInfo(tab)))
    );

    const result = await archiveTabGroup(tabInfos, secret, salt);
    return !!result;
  });
}

// ========== Runtime Message Handlers (from content scripts) ==========

/**
 * Sets up runtime message handlers (from content scripts)
 */
export function setupRuntimeMessageHandlers(): void {
  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    switch (message.type) {
      case RUNTIME_MESSAGES.OPEN_TAB:
        if ('url' in message && message.url) {
          createAsyncHandler(
            async () => {
              const tab = await browser.tabs.create({ url: message.url });
              return { tabId: tab.id };
            },
            sendResponse
          );
          return true;
        }
        break;

      case RUNTIME_MESSAGES.RESTORE_TABS:
        if ('tabs' in message && message.tabs) {
          createAsyncHandler(
            () => handleRestoreTabs(message.tabs),
            sendResponse
          );
          return true;
        }
        break;
    }

    return false;
  });
}

// ========== External Message Handlers (from web app) ==========

/**
 * Sets up external message handlers (from web app)
 */
export function setupExternalMessageHandlers(): void {
  browser.runtime.onMessageExternal.addListener(
    (message: ExternalMessage, _sender, sendResponse) => {
      switch (message.type) {
        case EXTERNAL_MESSAGES.PING:
          sendResponse(successResponse({ version: EXTENSION_VERSION }));
          return true;

        case EXTERNAL_MESSAGES.OPEN_SETTINGS: {
          const settingsUrl = browser.runtime.getURL('/popup.html') + '#/page/settings';
          browser.tabs.create({ url: settingsUrl });
          sendResponse(successResponse({ url: settingsUrl }));
          return true;
        }

        case EXTERNAL_MESSAGES.GET_EXTENSION_URL: {
          const baseUrl = browser.runtime.getURL('/');
          sendResponse(successResponse({ url: baseUrl }));
          return true;
        }

        case EXTERNAL_MESSAGES.GET_REDIRECT_URL: {
          const search = ('search' in message ? message.search : '') || '';
          const redirectUrl = browser.runtime.getURL('/web/index.html') + search;
          sendResponse(successResponse({ url: redirectUrl }));
          return true;
        }

        case EXTERNAL_MESSAGES.OPEN_WEB: {
          const path = ('path' in message ? message.path : '') || '';
          const webUrl = browser.runtime.getURL('/web/index.html') + path;
          browser.tabs.create({ url: webUrl });
          sendResponse(successResponse({ url: webUrl }));
          return true;
        }

        case EXTERNAL_MESSAGES.RESTORE_TABS:
          if ('tabs' in message && message.tabs) {
            createAsyncHandler(
              () => handleRestoreTabs(message.tabs),
              sendResponse
            );
            return true;
          }
          break;
      }

      sendResponse(errorResponse('Unknown message type'));
      return true;
    }
  );
}
