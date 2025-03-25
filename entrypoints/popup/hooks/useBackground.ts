import type { BridgeMessage } from "webext-bridge";
import type { ClientTabInfo } from "@/types/data";
import type { Setting } from "@/utils/Setting";

import React from "react";
import { onMessage, sendMessage } from "webext-bridge/popup";
import { notifyManager } from "@/utils/listenerManager";


class TabCache {
  #listeners: Set<(tabs: Record<string, ClientTabInfo>) => void> = new Set();
  #cache: Record<string, ClientTabInfo> = {};
  constructor() {
    this.subscribe = this.subscribe.bind(this);
    this.update = this.update.bind(this);
    this.get = this.get.bind(this);
  }
  subscribe(listener: () => void) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    }
  }
  updateDirectly = (message: BridgeMessage<any>) => {
    this.#cache = message.data as Record<string, ClientTabInfo>;
    console.log("updateDirectly", this.#listeners.size);
    this.#listeners.forEach((listener) => listener(message.data));
  }

  async update() {
    const tabs = await sendMessage("get-current-tabs", undefined, "background");
    this.#cache = tabs;
    this.#listeners.forEach((listener) => listener(tabs));
  }

  get() {
    return this.#cache;
  }
}

export const useSetting = () => {
  const [setting, setSetting] = React.useState<Setting | undefined>(undefined);
  React.useEffect(() => {
    async function getSetting() {
      const setting = await storage.getItem<Setting>(`local:${SETTING_KEY}`);
      if (setting) {
        setSetting(setting);
      }
    }
    getSetting();
    const unwatch = storage.watch(`local:${SETTING_KEY}`, (setting: Setting | null) => {
      if (setting) {
        setSetting(setting);
      }
    });
    return () => {
      unwatch();
    };
  }, []);
  return setting;
}

export const useTabs = () => {
  const [tabCache] = React.useState<TabCache>(() => new TabCache());

  React.useEffect(() => {
    tabCache.update();
    const unwatch = onMessage("tab-update", tabCache.updateDirectly);
    return () => {
      unwatch();
    };
  }, []);
  // NOTE: https://github.com/TanStack/query/blob/fb1dffca7b3384d7f27110583947b737121fb58b/packages/react-query/src/useBaseQuery.ts#L93-L94
  const result = tabCache.get();
  console.log(Object.values(result ?? {}).map((tab) => (new Date(tab.lastActiveAt).toLocaleString())));
  React.useSyncExternalStore(
    React.useCallback((onStoreChange) => tabCache.subscribe(
      notifyManager.batchCalls(onStoreChange)
    ), [tabCache]),
    () => tabCache.get(),
  );
  return result;
};