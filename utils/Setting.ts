import type { CloseRules } from "@/types/data";
import { settingStorage } from "./storage";

export const SETTING_KEY = "setting";

export interface Setting {
  closeRules: CloseRules;
  device?: string;
  refreshInterval?: number;
  blocklist: {
    url: string;
    rule: Omit<CloseRules, "ignoringGrouptabs" | "ignoreContainerTabs">;
  }[]; // 다른 규칙을 가지는 사이트
}

export const DEFAULT_SETTING: Setting = {
  closeRules: {
    idleCondition: "window",
    idleThreshold: 1,
    pinnedTabIgnore: false,
    mutedTabIgnore: false,
    containerTabIgnore: false,
  },
  device: "",
  blocklist: [
    ...import.meta.env.BROWSER === "chrome" ? [
      {
        url: "chrome://",
        rule: {
          idleCondition: "window",
          idleThreshold: 0,
        } satisfies CloseRules,
      },
      {
        url: "chrome-extension://",
        rule: {
          idleCondition: "window",
          idleThreshold: 0,
        } satisfies CloseRules,
      },
    ] : [],
    ...import.meta.env.BROWSER === "firefox" ? [
      {
        url: "about:",
        rule: {
          idleCondition: "window",
          idleThreshold: 0,
        } satisfies CloseRules,
      },
      {
        url: "firefox://",
        rule: {
          idleCondition: "window",
          idleThreshold: 0,
        } satisfies CloseRules,
      }
    ] : [],
  ],
};

export async function getSetting(): Promise<Setting> {
  const _setting = await settingStorage.getValue();
  if (!_setting) {
    await settingStorage.setValue(DEFAULT_SETTING);
  }
  return _setting ?? DEFAULT_SETTING;
}

export function getURLSetting(setting: Setting, url: string) {
  return setting.blocklist.find((block) => url.startsWith(block.url))?.rule ?? setting.closeRules;
}
