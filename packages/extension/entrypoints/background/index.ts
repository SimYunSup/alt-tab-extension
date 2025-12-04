/**
 * Background service worker entry point
 *
 * This module orchestrates all background functionality:
 * - Tab lifecycle management
 * - OAuth flow handling
 * - Message routing (internal and external)
 * - Content script injection
 */

import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { createLogger } from '@alt-tab/shared/logger';
import { settingStorage, accessTokenStorage } from '@/utils/storage';
import { initSettingIfLogin } from '@/utils/Setting';
import { setupMockAPI } from '@/mocks/setup';

import { setupStorageAccess, injectContentScriptToExistingTabs } from './content-script';
import { refreshTokens } from './oauth';
import {
  setupTabEventListeners,
  setupSettingsWatcher,
  initializeTabs,
} from './tab-lifecycle';
import {
  setupInternalMessageHandlers,
  setupRuntimeMessageHandlers,
  setupExternalMessageHandlers,
} from './messaging';
import type { IntervalEntry } from './types';

const logger = createLogger('Background');

// Enable mock API in development
if (import.meta.env.VITE_USE_MOCK_API === 'true') {
  logger.info('Setting up Mock API...');
  setupMockAPI();
}

export default defineBackground(() => {
  // Shared state
  let intervalResult: IntervalEntry[] = [];
  let cleanupInterval: () => void = () => {};

  const updateIntervalResult = (result: IntervalEntry[]) => {
    intervalResult = result;
  };

  // Initialize extension
  async function init(): Promise<void> {
    // Setup storage access for content scripts
    setupStorageAccess();

    // Inject content scripts into existing tabs
    await injectContentScriptToExistingTabs();

    // Initialize tab tracking
    cleanupInterval = await initializeTabs(updateIntervalResult);

    // Setup tab event listeners
    setupTabEventListeners(intervalResult, updateIntervalResult);

    // Setup settings watcher
    setupSettingsWatcher();

    // Setup message handlers
    setupInternalMessageHandlers();
    setupRuntimeMessageHandlers();
    setupExternalMessageHandlers();

    // Re-initialize on settings change
    settingStorage.watch(async (setting) => {
      if (!setting) return;
      cleanupInterval();
      cleanupInterval = await initializeTabs(updateIntervalResult);
    });

    // Handle browser startup
    browser.runtime.onStartup.addListener(async () => {
      cleanupInterval = await initializeTabs(updateIntervalResult);
      await refreshTokens();

      const token = await accessTokenStorage.getValue();
      if (token) {
        await initSettingIfLogin(token);
      }
    });

    logger.info('Background script initialized');
  }

  init();
});
