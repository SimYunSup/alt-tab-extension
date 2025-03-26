import type { BridgeMessage, ProtocolMap, ProtocolWithReturn } from "webext-bridge";
import type { Setting } from "@/utils/Setting";
import type { ClientTabInfo } from "@/types/data";


import React from "react";
import { onMessage, sendMessage } from "webext-bridge/popup";
import { notifyManager } from "@/utils/listenerManager";
import { SETTING_KEY } from "@/utils/Setting";
type ProtocolData<T extends keyof ProtocolMap> = ProtocolMap[T] extends ProtocolWithReturn<any, infer R> ? R : never;

class BackgroundCache<T extends keyof ProtocolMap> {
  #listeners: Set<(data: ProtocolData<T>) => void> = new Set();
  #cache: ProtocolData<T> = {} as ProtocolData<T>;
  #name: keyof ProtocolMap;
  constructor(name: T) {
    this.subscribe = this.subscribe.bind(this);
    this.update = this.update.bind(this);
    this.get = this.get.bind(this);
    this.#name = name;
  }
  subscribe(listener: () => void) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    }
  }
  // JsonData is not work with Record
  updateDirectly = (message: BridgeMessage<any>) => {
    this.#cache = message.data as ProtocolData<T>;
    this.#listeners.forEach((listener) => listener(message.data));
  }

  async update() {
    const data = await sendMessage<T>(this.#name, {}, "background");
    this.#cache = data as ProtocolData<T>;
    this.#listeners.forEach((listener) => listener(data as ProtocolData<T>));
  }

  get() {
    return this.#cache;
  }
}

export const useSetting = () => {
  const [setting, setSetting] = React.useState<Setting | null>(null);
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
        setSetting((_setting) => {
          if (JSON.stringify(_setting) !== JSON.stringify(setting)) {
            return setting;
          }
          return _setting;
        });
      }
    });
    return () => {
      unwatch();
    };
  }, []);
  React.useEffect(() => {
    async function setSetting() {
      await storage.setItem<Setting>(`local:${SETTING_KEY}`, setting ?? null);
    }
    setSetting();
  }, [setting]);

  return [setting, setSetting] as const;
}


const TabContextInstance = React.createContext<Record<string, ClientTabInfo> | null>(null);

export const TabContext = ({ children }: { children: React.ReactNode }) => {
  const [tabCache] = React.useState(() => new BackgroundCache("get-current-tabs"));

  React.useEffect(() => {
    tabCache.update();
    console.log("tabCache.update");
    const unwatch = onMessage("tab-update", tabCache.updateDirectly);
    return () => {
      console.log("unwatch");
      unwatch();
    };
  }, []);
  // NOTE: https://github.com/TanStack/query/blob/fb1dffca7b3384d7f27110583947b737121fb58b/packages/react-query/src/useBaseQuery.ts#L93-L94
  const result = tabCache.get();
  React.useSyncExternalStore(
    React.useCallback((onStoreChange) => tabCache.subscribe(
      notifyManager.batchCalls(onStoreChange)
    ), [tabCache]),
    () => tabCache.get(),
  );
  return (
    <TabContextInstance.Provider value={result}>
      {children}
    </TabContextInstance.Provider>
  );
}

export const useTabs = () => {
  const result = React.useContext(TabContextInstance);
  if (!result) {
    throw new Error("useTabs must be used within a TabContext");
  }
  return result;
};

export const useRecordTabs = () => {
  const [tabRecordCache] = React.useState(() => new BackgroundCache("get-record-tabs"));

  React.useEffect(() => {
    tabRecordCache.update();
    const unwatch = onMessage("record-tab-update", tabRecordCache.updateDirectly);
    return () => {
      unwatch();
    };
  }, []);
  // NOTE: https://github.com/TanStack/query/blob/fb1dffca7b3384d7f27110583947b737121fb58b/packages/react-query/src/useBaseQuery.ts#L93-L94
  const result = tabRecordCache.get();
  React.useSyncExternalStore(
    React.useCallback((onStoreChange) => tabRecordCache.subscribe(
      notifyManager.batchCalls(onStoreChange)
    ), [tabRecordCache]),
    () => tabRecordCache.get(),
  );
  return result;
};
