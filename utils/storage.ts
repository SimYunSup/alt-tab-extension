import type { Setting } from "./Setting";
import type { ClientTabInfo } from "./Tab";
import type { CloseRules } from "@/types/data";

import { storage } from "#imports";

export const currentTabStorage = storage.defineItem<Record<string, ClientTabInfo>>(
  "session:tabs",
  {
    fallback: {} as Record<string, ClientTabInfo>,
  }
);

export const settingStorage = storage.defineItem<Setting>(
  "local:settings",
  {
    fallback: {
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
          {
            url: "about:",
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
    },
  }
);

export const accessTokenStorage = storage.defineItem<string | null>(
  "local:accessToken",
  {
    fallback: null,
  }
);

export const refreshTokenStorage = storage.defineItem<string | null>(
  "local:refreshToken",
  {
    fallback: null,
  }
);
