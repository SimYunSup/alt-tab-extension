import "@total-typescript/ts-reset";
import type { ProtocolWithReturn } from "webext-bridge";
import type { InactiveType } from "./data";

declare module "webext-bridge" {
  export interface ProtocolMap {
    "get-scroll-position": ProtocolWithReturn<{ tabId: number }, ScrollPosition>;
    "refresh-tab": ProtocolWithReturn<{ tabId?: number }, void>;
    "refresh-interval": ProtocolWithReturn<{ tabId: number, type: InactiveType, interval: number }, void>;
    "get-current-tabs": ProtocolWithReturn<void, Record<string, ClientTabInfo>>;
    "tab-update": ProtocolWithReturn<Record<string, ClientTabInfo>, void>;
  }
}
