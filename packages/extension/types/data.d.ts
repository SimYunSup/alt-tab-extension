export type InactiveType = "window" | "visibility" | "idle";

export interface CloseRules {
  idleCondition: InactiveType;
  idleTimeout: number;
  /** When true, don't close tabs that are unloaded/discarded */
  ignoreUnloadedTab?: boolean;
  /** When true, close tabs even if playing audio (ignores audible status) */
  ignoreAudibleTab?: boolean;
  /** When true, don't close pinned tabs */
  allowPinnedTab?: boolean;
  /** When true, don't close tabs in groups/containers */
  ignoreContainerTab?: boolean;
}
export interface Setting {
  globalRule: CloseRules;
  refreshInterval?: number;
  whitelistUrls: Record<string, Omit<CloseRules, "ignoringGrouptabs" | "ignoreContainerTabs">>; // 다른 규칙을 가지는 사이트
}
