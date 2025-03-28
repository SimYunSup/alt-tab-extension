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
  const [isLoading, setIsLoading] = React.useState(false);
  const [settings, setSettings] = React.useState<Setting | null>(null);
  React.useEffect(() => {
    async function getSetting() {
      const _settings = await storage.getItem<Setting>(`local:${SETTING_KEY}`);
      if (_settings) {
        setSettings(_settings);
      }
    }
    getSetting();
    const unwatch = storage.watch(`local:${SETTING_KEY}`, (setting: Setting | null) => {
      if (setting) {
        setSettings((_settings) => {
          if (JSON.stringify(_settings) !== JSON.stringify(setting)) {
            return setting;
          }
          return _settings;
        });
      }
    });
    return () => {
      unwatch();
    };
  }, []);

  return {
    settings,
    async saveSettings(settingSetter: ((s: Setting | null) => Setting | null) | Setting | null) {
      const _settings = settingSetter instanceof Function ? settingSetter(settings) : settingSetter;
      setIsLoading(true);
      await storage.setItem<Setting>(`local:${SETTING_KEY}`, _settings ?? null);
      setSettings(_settings);
      setIsLoading(false);
    },
    isLoading,
  };
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
