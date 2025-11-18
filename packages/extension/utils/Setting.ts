import type { Setting } from "@/types/data";
import defu from "defu";
import { settingStorage } from "./storage";
import { DEFAULT_SETTING } from "./constants";

export const SETTING_KEY = "setting";





export async function initSettingIfLogin(token: string | null) {
  if (!token) {
    return;
  }
  const setting = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/stash-setting`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const settingJson = await setting.json() as Setting | null;
  if (!settingJson) {
    await settingStorage.setValue(DEFAULT_SETTING);
  } else {
    await settingStorage.setValue(defu(
      settingJson,
      DEFAULT_SETTING,
    ) as Setting);
  }
}
export async function saveSetting(setting: Setting, token: string | null) {
  await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/stash-setting/update`, {
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
