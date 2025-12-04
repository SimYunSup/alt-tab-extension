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

  for (const tab of tabs) {
    await restoreTabWithData(tab);
  }

  return { count: tabs.length };
}
