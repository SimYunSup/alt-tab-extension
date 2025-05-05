export type InactiveType = "window" | "visibility" | "idle";

export interface CloseRules {
  idleCondition: InactiveType; // 윈도우 바뀔 시 inactive, 탭이 안 보여지면 inactive, 요청이 없으면 inactive
  idleThreshold: number; // inactive까지의 시간
  unloadTabIgnore?: boolean; // unload되었어도 ignore
  playingTabIgnore?: boolean; // play중이여도 종료
  pinnedTabIgnore?: boolean; // pin할경우 ignore
  containerTabIgnore?: boolean;
}
