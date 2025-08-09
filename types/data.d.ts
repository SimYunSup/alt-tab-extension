export type InactiveType = "window" | "visibility" | "idle";

export interface CloseRules {
  idleCondition: InactiveType; // 윈도우 바뀔 시 inactive, 탭이 안 보여지면 inactive, 요청이 없으면 inactive
  idleTimeout: number; // inactive까지의 시간
  ignoreUnloadedTab?: boolean; // unload되었어도 ignore
  ignoreAudibleTab?: boolean; // play중이여도 종료
  allowPinnedTab?: boolean; // pin할경우 ignore
  ignoreContainerTab?: boolean;
}
export interface Setting {
  globalRule: CloseRules;
  refreshInterval?: number;
  whitelistUrls: Record<string, Omit<CloseRules, "ignoringGrouptabs" | "ignoreContainerTabs">>; // 다른 규칙을 가지는 사이트
}
