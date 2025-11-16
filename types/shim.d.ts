/// <reference types="vite-plugin-svgr/client" />
import "@total-typescript/ts-reset";
import type { ProtocolWithReturn } from "webext-bridge";
import type {
  InactiveType,
} from "./data";
import type {
  ClientTabInfo,
  ScrollPosition,
  StorageInfo,
} from "@/utils/Tab";
import type * as argon2 from "@node-rs/argon2";


declare module "webext-bridge" {
  export interface ProtocolMap {
    "refresh-tab": ProtocolWithReturn<{ tabId: number }, void>;
    "refresh-interval": ProtocolWithReturn<{ tabId: number; type: InactiveType; interval: number; enabled?: boolean }, void>;
    "get-tab-info": ProtocolWithReturn<void, { storage: StorageInfo, scrollPosition: ScrollPosition } | null>;
    "send-tab-group": ProtocolWithReturn<{ tabIds: number[]; secret: string; salt: string }, boolean>;
  }
}
declare global {
  export class IdleDetector{
    addEventListener(type: "change", listener: (this: IdleDetector, ev: { userState: "active" | "idle", screenState: "locked" | "unlocked" }) => unknown, options?: boolean | AddEventListenerOptions): void;
    start(options: { threshold: number; signal: AbortSignal }): Promise<void>;
    screenState: "locked" | "unlocked";
    userState: "active" | "idle";
    static requestPermission(): Promise<"granted" | "denied">;
  }
};

declare module "@node-rs/argon2/browser" {
  export const hash: typeof argon2.hash;
  export const hashRaw: typeof argon2.hashRaw;
  export const hashRawSync: typeof argon2.hashRawSync;
  export const hashSync: typeof argon2.hashSync;
  export const verify: typeof argon2.verify;
  export const verifySync: typeof argon2.verifySync;
}
export interface ImportMetaEnv extends ImportMetaEnv {
  VITE_OAUTH_BASE_URL: string;
}
