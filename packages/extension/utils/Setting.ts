import type { Setting } from "@/types/data";
import defu from "defu";
import { settingStorage } from "./storage";
import { DEFAULT_SETTING } from "./constants";
import { apiClient, HTTPError } from "./api";

export const SETTING_KEY = "setting";

export async function initSettingIfLogin(token: string | null) {
  if (!token) {
    return;
  }
  try {
    const settingJson = await apiClient.get<Setting | null>("stash-setting");
    if (!settingJson) {
      await settingStorage.setValue(DEFAULT_SETTING);
    } else {
      await settingStorage.setValue(defu(
        settingJson,
        DEFAULT_SETTING,
      ) as Setting);
    }
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error("Failed to fetch settings:", error.response.status, error.message);
    } else {
      console.error("Error fetching settings:", error);
    }
    await settingStorage.setValue(DEFAULT_SETTING);
  }
}

export async function saveSetting(setting: Setting, _token: string | null) {
  try {
    await apiClient.put("stash-setting/update", setting);
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error("Failed to save settings:", error.response.status, error.message);
    } else {
      console.error("Error saving settings:", error);
    }
  }
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
