import { accessTokenStorage } from "./storage";
import type { TabInfo } from "./Tab";

export async function archiveTabGroup(tabs: TabInfo[], secret?: string, salt?: string) {
  const token = await accessTokenStorage.getValue();
  const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      secret: secret ?? "SECRETTABGROUP",
      salt: salt ?? "SALT",
      browserTabInfos: tabs,
    }),
  });
  if (!response.ok) {
    console.error("Failed to archive tab group", response.statusText);
  }
}

export async function getArchivedTabGroup() {
  const token = await accessTokenStorage.getValue();
  const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    console.error("Failed to get archived tab group", response.statusText);
    return null;
  }
  return response.json();
}
