/**
 * Shared handler for restore_tabs messages
 * Used by both runtime and external message handlers
 */

import { createLogger } from '@alt-tab/shared/logger';
import { restoreTabWithData } from '../tab-restore';
import type { RestoredTabInfo } from '../types';

const logger = createLogger('RestoreTabsHandler');

export interface RestoreTabsResult {
  count: number;
}

/**
 * Handles restoring multiple tabs from archived data
 */
export async function handleRestoreTabs(tabs: RestoredTabInfo[]): Promise<RestoreTabsResult> {
  logger.info(`Restoring ${tabs.length} tabs`);

  let restoredCount = 0;
  for (const tab of tabs) {
    try {
      await restoreTabWithData(tab);
      restoredCount++;
    } catch (error) {
      logger.error(`Failed to restore tab: ${tab.url}`, error);
    }
  }

  return { count: restoredCount };
}
