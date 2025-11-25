import { accessTokenStorage } from "./storage";
import type { TabInfo } from "./Tab";

/**
 * Server-compatible tab info structure
 * Maps to backend's BrowserTabInfoDto
 */
export interface BrowserTabInfoDto {
  windowId: string;
  groupId: string | null;
  tabIndex: number;
  title: string;
  url: string;
  faviconUrl: string | null;
  incognito: boolean;
  scrollPosition: {
    x: number;
    y: number;
  };
  lastUsedAgent: string;
  lastActiveAt: number; // epoch seconds
  session: string;
  cookie: string;
}

/**
 * Converts client TabInfo to server-compatible format
 */
function convertToServerTabInfo(tab: TabInfo): BrowserTabInfoDto {
  return {
    windowId: tab.windowId,
    groupId: tab.groupId === "-1" ? null : tab.groupId,
    tabIndex: tab.tabIndex,
    title: tab.title,
    url: tab.url,
    faviconUrl: tab.faviconUrl ?? null,
    incognito: tab.isIncognito,
    scrollPosition: {
      x: tab.scrollPosition?.x ?? 0,
      y: tab.scrollPosition?.y ?? 0,
    },
    lastUsedAgent: tab.device,
    lastActiveAt: Math.floor(tab.lastActiveAt / 1000), // Convert ms to seconds
    session: tab.storage?.session ?? "{}",
    cookie: tab.storage?.cookies ?? "[]",
  };
}

/**
 * Server response types for Tab Group API
 */
export interface TabGroupResponse {
  id: string;
  secret: string;
  salt: string;
  browserTabInfos: BrowserTabInfoDto[];
  createdAt?: number; // epoch seconds (optional, for UI display)
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

    // Check if response has content before parsing
    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type");

    if (contentLength === "0" || !contentType?.includes("application/json")) {
      // Backend returned success but no JSON body
      console.log("Tab group archived successfully (no response body)");
      return {
        id: "unknown",
        secret,
        salt,
        browserTabInfos: tabs.map(convertToServerTabInfo),
        createdAt: Math.floor(Date.now() / 1000),
      };
    }

    const text = await response.text();
    if (!text || text.trim() === "") {
      // Empty response body
      console.log("Tab group archived successfully (empty response body)");
      return {
        id: "unknown",
        secret,
        salt,
        browserTabInfos: tabs.map(convertToServerTabInfo),
        createdAt: Math.floor(Date.now() / 1000),
      };
    }

    return JSON.parse(text) as TabGroupResponse;
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
    // Use web app URL instead of backend URL for sharing
    const webAppUrl = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173';
    return `${webAppUrl}${data.path}`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return null;
  }
}
