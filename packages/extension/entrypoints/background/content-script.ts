/**
 * Content script injection module
 */

import { browser } from 'wxt/browser';
import { createLogger } from '@alt-tab/shared/logger';

const logger = createLogger('ContentScript');

const NON_INJECTABLE_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'moz-extension://',
];

function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return !NON_INJECTABLE_PREFIXES.some(prefix => url.startsWith(prefix));
}

/**
 * Injects content scripts into all existing tabs
 */
export async function injectContentScriptToExistingTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (!isInjectableUrl(tab.url)) continue;

    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/content.js'],
      });
      logger.debug(`Injected content script into tab ${tab.id}: ${tab.url}`);
    } catch (error) {
      logger.warn(`Failed to inject content script into tab ${tab.id}:`, error);
    }
  }
}

/**
 * Sets up chrome.storage.session access level for content scripts
 */
export async function setupStorageAccess(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session?.setAccessLevel) {
    try {
      await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      });
      logger.debug('Storage session access level configured');
    } catch (error) {
      logger.warn('Failed to set storage.session access level:', error);
    }
  }
}
