export type InactiveType = "window" | "visiblity" | "idle";

export interface CloseRules {
  idleCondition: InactiveType; // 윈도우 바뀔 시 inactive, 탭이 안 보여지면 inactive, 요청이 없으면 inactive
  idleThreshold: number; // inactive까지의 시간
  mutedTabIgnore?: boolean; // mute할경우 ignore
  pinnedTabIgnore?: boolean; // pin할경우 ignore
  containerTabIgnore?: boolean;
}
