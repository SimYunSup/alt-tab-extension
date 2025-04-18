import type { ClientTabInfo } from "@/utils/Tab";
import type { Setting } from "@/utils/Setting";

import React from "react";
import { saveTabIndexedDB } from "@/utils/Tab";
import { DEFAULT_SETTING } from "@/utils/Setting";
import {
  accessTokenStorage,
  currentTabStorage,
  settingStorage,
} from "@/utils/storage";

export const useTabs = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [tabs, setTabs] = React.useState<Record<string, ClientTabInfo> | null>(null);
  React.useEffect(() => {
    async function getTabs() {
      const _tabs = await currentTabStorage.getValue();
      if (_tabs) {
        setTabs(_tabs);
        setIsLoading(false);
      }
    }
    getTabs();
    const unwatch = currentTabStorage.watch((newTabs) => {
      if (newTabs) {
        setTabs(newTabs);
      }
    });
    return () => {
      unwatch();
    };
  }, []);

  return {
    tabs,
    async closeTab(tabId: string[]) {
      setIsLoading(true);
      const _tabs = await currentTabStorage.getValue();
      if (_tabs) {
        await Promise.all(Object.entries(_tabs).map(async ([id, info]) => {
          if (tabId.includes(id)) {
            delete _tabs[id];
            const tab = await chrome.tabs.get(Number(id));
            await Promise.all([
              chrome.tabs.remove(tab.id!),
              saveTabIndexedDB(tab, info),
            ]);
          }
        }));
        await currentTabStorage.setValue(_tabs);
        setIsLoading(false);
      }
    },
    isLoading,
  };
}

export const useSetting = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [settings, setSettings] = React.useState<Setting | null>(null);
  React.useEffect(() => {
    async function getSetting() {
      const _settings = await settingStorage.getValue();
      if (_settings) {
        setSettings(_settings);
      }
    }
    getSetting();
    const unwatch = settingStorage.watch((setting) => {
      if (setting) {
        setSettings(setting);
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
      await settingStorage.setValue(_settings ?? DEFAULT_SETTING);
      setSettings(_settings);
      setIsLoading(false);
    },
    isLoading,
  };
}

export const useToken = () => {
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => {
    async function getSetting() {
      const _settings = await accessTokenStorage.getValue();
      if (_settings) {
        setToken(_settings);
      }
    }
    getSetting();
    const unwatch = accessTokenStorage.watch((newToken: string | null) => {
      if (newToken) {
        setToken(newToken);
      }
    });
    return () => {
      unwatch();
    };
  }, []);

  return token;
}
