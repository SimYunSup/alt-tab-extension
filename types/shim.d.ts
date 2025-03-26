/// <reference types="vite-plugin-svgr/client" />
import "@total-typescript/ts-reset";
import type { ProtocolWithReturn } from "webext-bridge";
import type {
  InactiveType,
  ClientTabInfo,
  TabInfo,
  StorageInfo,
} from "./data";

declare module "webext-bridge" {
  export interface ProtocolMap {
    "refresh-tab": ProtocolWithReturn<{ tabId?: number }, void>;
    "refresh-interval": ProtocolWithReturn<{ tabId: number, type: InactiveType, interval: number }, void>;
    "get-current-tabs": ProtocolWithReturn<void, Record<string, ClientTabInfo>>;
    "tab-update": ProtocolWithReturn<Record<string, ClientTabInfo>, void>;
    "get-record-tabs": ProtocolWithReturn<void, TabInfo[]>;
    "record-tab-update": ProtocolWithReturn<TabInfo[], void>;
    "get-tab-info": ProtocolWithReturn<void, { storage: StorageInfo, scrollPosition: ScrollPosition } | null>;
  }
}
