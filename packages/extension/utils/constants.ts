import type { Setting, CloseRules } from "@/types/data";

export const DEFAULT_SETTING: Setting = {
  globalRule: {
    idleCondition: "window",
    idleTimeout: 1,
    ignoreUnloadedTab: false,
    allowPinnedTab: true,
    ignoreAudibleTab: false,
    ignoreContainerTab: false,
  },
  whitelistUrls: {
    ...import.meta.env.BROWSER === "chrome" ? {
      "chrome://": {
        idleCondition: "window",
        idleTimeout: 0,
        ignoreUnloadedTab: false,
        allowPinnedTab: true,
        ignoreAudibleTab: false,
      } satisfies CloseRules,
      "chrome-extension://": {
        idleCondition: "window",
        idleTimeout: 0,
        ignoreUnloadedTab: false,
        allowPinnedTab: true,
        ignoreAudibleTab: false,
      } satisfies CloseRules,
      "about:": {
        idleCondition: "window",
        idleTimeout: 0,
        ignoreUnloadedTab: false,
        allowPinnedTab: true,
        ignoreAudibleTab: false,
      } satisfies CloseRules,
    } : {},
    ...import.meta.env.BROWSER === "firefox" ? {
      "about:": {
        idleCondition: "window",
        idleTimeout: 0,
        ignoreUnloadedTab: false,
        allowPinnedTab: true,
        ignoreAudibleTab: false,
      } satisfies CloseRules,
      "firefox://": {
        idleCondition: "window",
        idleTimeout: 0,
        ignoreUnloadedTab: false,
        allowPinnedTab: true,
        ignoreAudibleTab: false,
      } satisfies CloseRules,
    } : {},
  },
};
