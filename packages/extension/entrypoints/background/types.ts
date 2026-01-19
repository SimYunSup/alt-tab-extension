/**
 * Shared types for background script modules
 */

import type { ClientTabInfo } from '@/utils/Tab';
import type { Setting } from '@/types/data';
import type { RUNTIME_MESSAGES, EXTERNAL_MESSAGES } from '@/utils/message-types';

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

// ========== Runtime Message Types ==========

export interface OpenTabMessage {
  type: typeof RUNTIME_MESSAGES.OPEN_TAB;
  url: string;
}

export interface RuntimeRestoreTabsMessage {
  type: typeof RUNTIME_MESSAGES.RESTORE_TABS;
  tabs: RestoredTabInfo[];
}

export type RuntimeMessage = OpenTabMessage | RuntimeRestoreTabsMessage;

// ========== External Message Types ==========

export interface PingMessage {
  type: typeof EXTERNAL_MESSAGES.PING;
}

export interface OpenSettingsMessage {
  type: typeof EXTERNAL_MESSAGES.OPEN_SETTINGS;
}

export interface GetExtensionUrlMessage {
  type: typeof EXTERNAL_MESSAGES.GET_EXTENSION_URL;
}

export interface GetRedirectUrlMessage {
  type: typeof EXTERNAL_MESSAGES.GET_REDIRECT_URL;
  search?: string;
}

export interface OpenWebMessage {
  type: typeof EXTERNAL_MESSAGES.OPEN_WEB;
  path?: string;
}

export interface ExternalRestoreTabsMessage {
  type: typeof EXTERNAL_MESSAGES.RESTORE_TABS;
  tabs: RestoredTabInfo[];
}

export type ExternalMessage =
  | PingMessage
  | OpenSettingsMessage
  | GetExtensionUrlMessage
  | GetRedirectUrlMessage
  | OpenWebMessage
  | ExternalRestoreTabsMessage;
