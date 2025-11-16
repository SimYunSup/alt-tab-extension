import { accessTokenStorage } from "./storage";
import type { TabInfo, ScrollPosition, StorageInfo } from "./Tab";

/**
 * Server-compatible tab info structure
 * Maps to backend's BrowserTabInfoDto
 */
export interface ServerTabInfo {
  id: string;
  title: string;
  url: string;
  tabIndex: number;
  isPinned?: boolean;
  isAudible?: boolean;
  isUnloaded?: boolean;
  groupId?: string;
  windowId: string;
  faviconUrl?: string;
  lastActiveAt: number; // epoch seconds (not milliseconds)
  lastUsedAgent: string; // maps from device
  incognito: boolean; // maps from isIncognito
  scrollPosition?: ScrollPosition;
  storage?: StorageInfo;
}

/**
 * Converts client TabInfo to server-compatible format
 */
function convertToServerTabInfo(tab: TabInfo): ServerTabInfo {
  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    tabIndex: tab.tabIndex,
    isPinned: tab.isPinned,
    isAudible: tab.isAudible,
    isUnloaded: tab.isUnloaded,
    groupId: tab.groupId,
    windowId: tab.windowId,
    faviconUrl: tab.faviconUrl,
    lastActiveAt: Math.floor(tab.lastActiveAt / 1000), // Convert ms to seconds
    lastUsedAgent: tab.device, // Rename field
    incognito: tab.isIncognito, // Rename field
    scrollPosition: tab.scrollPosition,
    storage: tab.storage,
  };
}

/**
 * Server response types for Tab Group API
 */
export interface TabGroupResponse {
  id: string;
  createdAt: number;
  secret: string;
  salt: string;
  browserTabInfos: ServerTabInfo[];
}

export interface QRCodeResponse {
  path: string;
}

/**
 * Archives a tab group to the server
 * @param tabs - Array of tabs to archive
 * @param secret - Base64 encoded encryption secret (derived from PIN)
 * @param salt - Base64 encoded salt (used for PIN verification)
 * @returns The created tab group with ID
 */
export async function archiveTabGroup(
  tabs: TabInfo[],
  secret: string,
  salt: string
): Promise<TabGroupResponse | null> {
  try {
    const token = await accessTokenStorage.getValue();
    // Convert client TabInfo to server-compatible format
    const serverTabInfos = tabs.map(convertToServerTabInfo);

    const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        secret,
        salt,
        browserTabInfos: serverTabInfos,
      }),
    });

    if (!response.ok) {
      console.error("Failed to archive tab group", response.statusText);
      return null;
    }

    return await response.json() as TabGroupResponse;
  } catch (error) {
    console.error("Error archiving tab group:", error);
    return null;
  }
}

/**
 * Retrieves all archived tab groups for the current user
 * @returns Array of tab groups
 */
export async function getArchivedTabGroups(): Promise<TabGroupResponse[]> {
  try {
    const token = await accessTokenStorage.getValue();
    const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to get archived tab groups", response.statusText);
      return [];
    }

    const data: TabGroupResponse[] | unknown = await response.json();
    return Array.isArray(data) ? data as TabGroupResponse[] : [];
  } catch (error) {
    console.error("Error fetching archived tab groups:", error);
    return [];
  }
}

/**
 * Deletes a tab group by ID
 * @param id - Tab group ID to delete
 * @returns true if successful, false otherwise
 */
export async function deleteTabGroup(id: string): Promise<boolean> {
  try {
    const token = await accessTokenStorage.getValue();
    const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      console.error("Failed to delete tab group", response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting tab group:", error);
    return false;
  }
}

/**
 * Generates a QR code for sharing a tab group
 * @param id - Tab group ID
 * @returns QR code path/URL or null if failed
 */
export async function generateQRCode(id: string): Promise<string | null> {
  try {
    const token = await accessTokenStorage.getValue();
    const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group/qr-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      console.error("Failed to generate QR code", response.statusText);
      return null;
    }

    const data = await response.json() as QRCodeResponse;
    return `${import.meta.env.VITE_OAUTH_BASE_URL}${data.path}`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return null;
  }
}
