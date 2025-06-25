import type { CloseRules } from "@/types/data";
import { settingStorage } from "./storage";

export const SETTING_KEY = "setting";

export interface Setting {
  globalRule: CloseRules;
  refreshInterval?: number;
  whitelistUrls: Record<string, Omit<CloseRules, "ignoringGrouptabs" | "ignoreContainerTabs">>; // 다른 규칙을 가지는 사이트
}

export const DEFAULT_SETTING: Setting = {
  globalRule: {
    idleCondition: "window",
    idleThreshold: 1,
    unloadTabIgnore: false,
    pinnedTabIgnore: false,
    playingTabIgnore: false,
    containerTabIgnore: false,
  },
  whitelistUrls: {
    ...import.meta.env.BROWSER === "chrome" ? {
        "chrome://": {
          idleCondition: "window",
          idleThreshold: 0,
        } satisfies CloseRules,
        "chrome-extension://": {
          idleCondition: "window",
          idleThreshold: 0,
        } satisfies CloseRules,
          "about:": {
            idleCondition: "window",
            idleThreshold: 0,
          } satisfies CloseRules,
      } : {},
    ...import.meta.env.BROWSER === "firefox" ? {
      "about:": {
        idleCondition: "window",
        idleThreshold: 0,
      } satisfies CloseRules,
      "firefox://": {
        idleCondition: "window",
        idleThreshold: 0,
      } satisfies CloseRules,
    } : {},
  },
};

export async function initSettingIfLogin(token: string | null) {
  if (!token) {
    return;
  }
  const setting = await fetch(`${import.meta.env.VITE_API_URL}/stash-settings`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const settingJson = await setting.json() as Setting | null;
  if (!settingJson) {
    await settingStorage.setValue(DEFAULT_SETTING);
  } else {
    await settingStorage.setValue({
      ...DEFAULT_SETTING,
      ...settingJson,
    });
  }
}
export async function saveSetting(setting: Setting, token: string | null) {
  await fetch(`${import.meta.env.VITE_API_URL}/stash-settings/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(setting),
  });
}

export async function getSetting(): Promise<Setting> {
  const _setting = await settingStorage.getValue();
  if (!_setting) {
    await settingStorage.setValue(DEFAULT_SETTING);
  }
  return _setting ?? DEFAULT_SETTING;
}

export function getURLSetting(setting: Setting, url: string) {
  return Object.entries(setting.whitelistUrls).find(([blockUrl]) => url.startsWith(blockUrl))?.[1] ?? setting.globalRule;
}
