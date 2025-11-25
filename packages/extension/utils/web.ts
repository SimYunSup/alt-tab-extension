import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';

/**
 * Get the URL for the embedded web app
 * @param path - Optional path to append (e.g., "?id=xxx" or "#/route")
 * @returns The full URL to the embedded web app
 */
export function getWebAppUrl(path: string = ""): string {
  return browser.runtime.getURL("/web/index.html") + path;
}

/**
 * Open the embedded web app in a new tab
 * @param path - Optional path to append (e.g., "?id=xxx")
 * @returns Promise resolving to the created tab
 */
export async function openWebApp(path: string = ""): Promise<Browser.tabs.Tab> {
  const url = getWebAppUrl(path);
  return browser.tabs.create({ url });
}

/**
 * Open the tab group restore page with the given ID
 * @param tabGroupId - The ID of the tab group to restore
 * @returns Promise resolving to the created tab
 */
export async function openTabGroupRestore(tabGroupId: string): Promise<Browser.tabs.Tab> {
  return openWebApp(`?id=${tabGroupId}`);
}
