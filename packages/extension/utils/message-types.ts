/**
 * Centralized message type constants for all message APIs
 */

// webext-bridge message types (typed via ProtocolMap in types/shim.d.ts)
export const BRIDGE_MESSAGES = {
  REFRESH_TAB: 'refresh-tab',
  REFRESH_INTERVAL: 'refresh-interval',
  GET_TAB_INFO: 'get-tab-info',
  SEND_TAB_GROUP: 'send-tab-group',
  RESTORE_STORAGE: 'restore-storage',
} as const;

// Runtime message types (content script -> background via chrome.runtime.onMessage)
export const RUNTIME_MESSAGES = {
  OPEN_TAB: 'open_tab',
  RESTORE_TABS: 'restore_tabs',
} as const;

// External message types (web app -> background via chrome.runtime.onMessageExternal)
export const EXTERNAL_MESSAGES = {
  PING: 'ping',
  OPEN_SETTINGS: 'open_settings',
  GET_EXTENSION_URL: 'get_extension_url',
  GET_REDIRECT_URL: 'get_redirect_url',
  OPEN_WEB: 'open_web',
  RESTORE_TABS: 'restore_tabs',
} as const;

// Window message types (web app <-> content script via window.postMessage)
export const WINDOW_MESSAGES = {
  // Inbound from web app
  PING: 'ping',
  GET_REDIRECT_URL: 'get_redirect_url',
  RESTORE_TABS: 'restore_tabs',
  // Outbound to web app
  PONG: 'pong',
  REDIRECT_URL_RESPONSE: 'redirect_url_response',
  RESTORE_TABS_RESPONSE: 'restore_tabs_response',
} as const;

// Source identifiers for window messages
export const MESSAGE_SOURCES = {
  WEB_APP: 'alt-tab-web',
  EXTENSION: 'alt-tab-extension',
} as const;
