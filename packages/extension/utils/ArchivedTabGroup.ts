import type { TabInfo } from "./Tab";
import { apiClient, HTTPError } from "./api";
import {
  base64ToArrayBuffer,
  importAesKey,
  aesGcmEncrypt,
  arrayBufferToBase64,
  textToUint8Array,
} from "./crypto";

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
  session: string;      // Encrypted with AES-GCM (format: iv:ciphertext in base64)
  cookie: string;       // Encrypted with AES-GCM (format: iv:ciphertext in base64)
  local: string;        // Encrypted with AES-GCM (format: iv:ciphertext in base64)
}

/**
 * Encrypts sensitive data using AES-GCM
 * @param data - Plain text data to encrypt
 * @param secretBase64 - Base64 encoded secret key (32 bytes for AES-256)
 * @returns Encrypted data in format "iv:ciphertext" (both base64 encoded)
 */
async function encryptSensitiveData(data: string, secretBase64: string): Promise<string> {
  try {
    const secretBytes = base64ToArrayBuffer(secretBase64);
    const key = await importAesKey(secretBytes);
    const dataBytes = textToUint8Array(data);
    const { ciphertext, iv } = await aesGcmEncrypt(dataBytes, key);

    // Format: iv:ciphertext (both base64 encoded)
    return `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(ciphertext)}`;
  } catch (error) {
    console.error("[E2EE] Failed to encrypt sensitive data:", error);
    throw new Error("Encryption failed");
  }
}

/**
 * Converts client TabInfo to server-compatible format with encrypted sensitive data
 * @param tab - Client tab info
 * @param secret - Base64 encoded encryption secret (derived from PIN via Argon2)
 */
async function convertToServerTabInfo(tab: TabInfo, secret: string): Promise<BrowserTabInfoDto> {
  // Encrypt sensitive data (session, cookie, local storage)
  const sessionData = tab.storage?.session ?? "{}";
  const cookieData = tab.storage?.cookies ?? "[]";
  const localData = tab.storage?.local ?? "{}";

  const [encryptedSession, encryptedCookie, encryptedLocal] = await Promise.all([
    encryptSensitiveData(sessionData, secret),
    encryptSensitiveData(cookieData, secret),
    encryptSensitiveData(localData, secret),
  ]);

  return {
    windowId: tab.windowId,
    groupId: tab.groupId === "-1" ? null : tab.groupId ?? null,
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
    session: encryptedSession,
    cookie: encryptedCookie,
    local: encryptedLocal,
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
    // Convert client TabInfo to server-compatible format with encryption
    console.log("[E2EE] Encrypting sensitive tab data...");
    const serverTabInfos = await Promise.all(
      tabs.map((tab) => convertToServerTabInfo(tab, secret))
    );
    console.log("[E2EE] Encryption complete for", serverTabInfos.length, "tabs");

    const result = await apiClient.post<TabGroupResponse | null>("tab-group", {
      secret,
      salt,
      browserTabInfos: serverTabInfos,
    });

    if (!result) {
      // Backend returned success but no JSON body
      console.log("Tab group archived successfully (no response body)");
      return {
        id: "unknown",
        secret,
        salt,
        browserTabInfos: serverTabInfos,
        createdAt: Math.floor(Date.now() / 1000),
      };
    }

    return result;
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error("Failed to archive tab group:", error.response.status, error.message);
    } else {
      console.error("Error archiving tab group:", error);
    }
    return null;
  }
}

/**
 * Retrieves all archived tab groups for the current user
 * @returns Array of tab groups
 */
export async function getArchivedTabGroups(): Promise<TabGroupResponse[]> {
  try {
    const data = await apiClient.get<TabGroupResponse[] | unknown>("tab-group");
    return Array.isArray(data) ? data as TabGroupResponse[] : [];
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error("Failed to get archived tab groups:", error.response.status, error.message);
    } else {
      console.error("Error fetching archived tab groups:", error);
    }
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
    await apiClient.delete("tab-group", { id });
    return true;
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error("Failed to delete tab group:", error.response.status, error.message);
    } else {
      console.error("Error deleting tab group:", error);
    }
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
    const data = await apiClient.post<QRCodeResponse>("tab-group/qr-code", { id });
    // Use web app URL instead of backend URL for sharing
    const webAppUrl = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173';
    return `${webAppUrl}${data.path}`;
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error("Failed to generate QR code:", error.response.status, error.message);
    } else {
      console.error("Error generating QR code:", error);
    }
    return null;
  }
}
