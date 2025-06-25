import type { TabInfo } from "./Tab";

export async function archiveTabGroup(tabs: TabInfo[]) {
  const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tabs),
  });
  if (!response.ok) {
    console.error("Failed to archive tab group", response.statusText);
  }
}

export async function getArchivedTabGroup() {
  const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/tab-group`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    console.error("Failed to get archived tab group", response.statusText);
    return null;
  }
  return response.json();
}
