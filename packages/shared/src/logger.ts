/**
 * @alt-tab/shared/logger
 *
 * Centralized logging utility using consola
 * Provides consistent logging across extension and web app
 */

import { createConsola, type ConsolaInstance, type LogLevel } from 'consola';

export type { LogLevel };

/** Log levels mapped to readable names */
export const LOG_LEVELS = {
  silent: -1,
  fatal: 0,
  error: 0,
  warn: 1,
  log: 2,
  info: 3,
  success: 3,
  debug: 4,
  trace: 5,
  verbose: 5,
} as const;

/**
 * Determines the appropriate log level based on environment
 */
function getDefaultLogLevel(): LogLevel {
  // In production, only show warnings and errors
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as { env?: { MODE?: string; DEV?: boolean } }).env;
    if (env?.MODE === 'production' || env?.DEV === false) {
      return LOG_LEVELS.warn;
    }
  }
  // In development, show all logs
  return LOG_LEVELS.debug;
}

/**
 * Creates a logger instance with a specific tag
 * @param tag - Tag to identify the source of logs (e.g., 'Background', 'Crypto', 'API')
 */
export function createLogger(tag: string): ConsolaInstance {
  return createConsola({
    level: getDefaultLogLevel(),
    formatOptions: {
      date: false,
      colors: true,
      compact: true,
    },
  }).withTag(tag);
}

// Pre-configured loggers for common modules
export const backgroundLogger = createLogger('Background');
export const cryptoLogger = createLogger('Crypto');
export const apiLogger = createLogger('API');
export const contentLogger = createLogger('Content');
export const popupLogger = createLogger('Popup');
export const webLogger = createLogger('Web');

// Default logger instance
export const logger = createLogger('Alt-Tab');

/**
 * Sets the global log level for all loggers
 * Useful for debugging in production or silencing logs in tests
 */
export function setLogLevel(level: LogLevel): void {
  logger.level = level;
  backgroundLogger.level = level;
  cryptoLogger.level = level;
  apiLogger.level = level;
  contentLogger.level = level;
  popupLogger.level = level;
  webLogger.level = level;
}

/**
 * Silences all loggers (useful for tests)
 */
export function silenceLogs(): void {
  setLogLevel(LOG_LEVELS.silent);
}

/**
 * Enables verbose logging (useful for debugging)
 */
export function enableVerboseLogs(): void {
  setLogLevel(LOG_LEVELS.verbose);
}
