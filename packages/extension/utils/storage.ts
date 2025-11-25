import type { ClientTabInfo } from "./Tab";

import { storage } from "#imports";
import { CloseRules, Setting } from "@/types/data";
import { DEFAULT_SETTING } from "./constants";

export const currentTabStorage = storage.defineItem<Record<string, ClientTabInfo>>(
  "session:tabs",
  {
    fallback: {} as Record<string, ClientTabInfo>,
  }
);

export const settingStorage = storage.defineItem<Setting>(
  "local:settings",
  {
    fallback: DEFAULT_SETTING,
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

// Store creation times for tab groups (id -> epoch seconds)
export const tabGroupCreatedAtStorage = storage.defineItem<Record<string, number>>(
  "local:tabGroupCreatedAt",
  {
    fallback: {},
  }
);
