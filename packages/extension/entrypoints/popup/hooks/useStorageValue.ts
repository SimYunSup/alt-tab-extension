import type { ClientTabInfo } from "@/utils/Tab";
import type { Setting } from "@/types/data";

import React from "react";
import { browser } from 'wxt/browser';
import { saveTabIndexedDB } from "@/utils/Tab";
import { saveSetting as _saveSetting, initSettingIfLogin } from "@/utils/Setting";
import {
  accessTokenStorage,
  currentTabStorage,
  refreshTokenStorage,
  settingStorage,
} from "@/utils/storage";
import { DEFAULT_SETTING } from "@/utils/constants";

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
            const tab = await browser.tabs.get(Number(id));
            await Promise.all([
              browser.tabs.remove(tab.id!),
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
  const [isLoading, setIsLoading] = React.useState(true);
  const [token, , tokenLoading] = useToken();
  const [settings, setSettings] = React.useState<Setting | null>(null);
  const prevTokenRef = React.useRef<string | null | undefined>(undefined);

  // Token 변경 감지하여 설정 로드 소스 결정
  React.useEffect(() => {
    // 토큰 초기 로딩 중이면 대기
    if (tokenLoading) return;

    // 토큰 상태가 변경되지 않았으면 스킵 (초기화 제외)
    const prevToken = prevTokenRef.current;
    if (prevToken !== undefined && prevToken === token) return;
    prevTokenRef.current = token;

    async function loadSettings() {
      setIsLoading(true);

      if (token) {
        // 로그인 상태: 서버에서 설정 fetch
        await initSettingIfLogin(token);
      }

      // local storage에서 설정 로드 (서버 fetch 후 local에 저장됨)
      const _settings = await settingStorage.getValue();
      setSettings(_settings ?? DEFAULT_SETTING);
      setIsLoading(false);
    }

    loadSettings();
  }, [token, tokenLoading]);

  // Storage 변경 감시 (다른 탭/컨텍스트에서 변경 시)
  React.useEffect(() => {
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

      // 항상 local storage에 저장
      await settingStorage.setValue(_settings ?? DEFAULT_SETTING);

      // 로그인 상태면 서버에도 저장
      if (token) {
        await _saveSetting(_settings ?? DEFAULT_SETTING, token);
      }

      setSettings(_settings);
      setIsLoading(false);
    },
    isLoading,
  };
}

export const useToken = () => {
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function getToken() {
      const _token = await accessTokenStorage.getValue();
      setToken(_token);
      setIsLoading(false);
    }
    getToken();
    const unwatch = accessTokenStorage.watch((newToken: string | null) => {
      setToken(newToken);
    });
    return () => {
      unwatch();
    };
  }, []);

  const resetToken = async () => {
    await accessTokenStorage.setValue(null);
    await refreshTokenStorage.setValue(null);
    setToken(null);
  };

  return [token, resetToken, isLoading] as const;
}
