/**
 * Shared types for background script modules
 */

import type { ClientTabInfo } from '@/utils/Tab';
import type { Setting } from '@/types/data';

/**
 * Data structure for restored tabs from web app or content script
 */
export interface RestoredTabInfo {
  url: string;
  title?: string;
  faviconUrl?: string;
  scrollPosition?: { x: number; y: number };
  session?: string;
  cookie?: string;
  local?: string;
}

/**
 * Interval tracking entry [tabId, isContentScript]
 */
export type IntervalEntry = [string, boolean];

/**
 * Shared state for the background script
 */
export interface BackgroundState {
  intervalResult: IntervalEntry[];
}
