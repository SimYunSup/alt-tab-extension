import type { CloseRules } from "@/types/data";

export const SETTING_KEY = "setting";

export interface Setting {
  closeRules: CloseRules;
  device: string;
  refreshInterval: number;
  blocklist: {
    url: string;
    rule: Omit<CloseRules, "ignoringGrouptabs" | "ignoreContainerTabs">;
  }[]; // 다른 규칙을 가지는 사이트
}

export const DEFAULT_SETTING: Setting = {
  closeRules: {
    idleCondition: "window",
    idleThreshold: 10,
    pinnedTabIgnore: false,
    mutedTabIgnore: false,
    containerTabIgnore: false,
  },
  device: "",
  refreshInterval: 10000,
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
