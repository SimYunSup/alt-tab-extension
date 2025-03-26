export interface ClientTabInfo {
  id: string;
  title: string;
  url: string;
  tabIndex: number; // 탭 순서
  groupId?: string; // 탭 그룹 id(chrome) or 컨테이너 id(firefox)
  windowId: string; // 윈도 id
  faviconUrl?: string; // 저장된 favicon url
  lastActiveAt: number;
}
export interface TabInfo extends ClientTabInfo {
  device: string;
  isIncognito: boolean;
  scrollPosition?: ScrollPosition;
  storge?: StorageInfo;
}

export interface StorageInfo {
  session?: string;
  cookies?: string;
  local?: string;
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export type InactiveType = "window" | "visiblity" | "idle";

export interface CloseRules {
  idleCondition: InactiveType; // 윈도우 바뀔 시 inactive, 탭이 안 보여지면 inactive, 요청이 없으면 inactive
  idleThreshold: number; // inactive까지의 시간
  mutedTabIgnore?: boolean; // mute할경우 ignore
  pinnedTabIgnore?: boolean; // pin할경우 ignore
  containerTabIgnore?: boolean;
}
