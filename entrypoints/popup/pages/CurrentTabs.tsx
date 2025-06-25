import type { ClientTabInfo } from "@/utils/Tab";
import { getURLSetting, type Setting } from "@/utils/Setting";

import React from "react";
import { browser } from 'wxt/browser';
import {
  ArchiveIcon,
  Clock,
  Search,
  XIcon,
} from "lucide-react";
import { Badge } from "@/entrypoints/components/ui/badge";
import { Input } from "@/entrypoints/components/ui/input";
import { Button } from "@/entrypoints/components/ui/button";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Separator } from "@/entrypoints/components/ui/separator";
import { cn } from "@/utils";
import { isClosableTab, saveTabIndexedDB } from "@/utils/Tab";
import { useSetting, useTabs, useToken } from "../hooks/useStorageValue";

const formatRemainingTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) {
    return seconds > 0 ? `${seconds}초` : "종료 중"
  } else {
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분 ${seconds % 60}초`
  }
}

const getTimeColor = (seconds: number, limit: number) => {
  if (seconds / limit < 0.25) return "text-red-500 bg-red-50"
  if (seconds / limit < 0.5) return "text-amber-500 bg-amber-50"
  return "text-emerald-500 bg-emerald-50"
}

function normalizeTabs(tabs: Record<string, ClientTabInfo>) {
  const tabWindows = Object.values(tabs).reduce((acc, tab) => {
    const windowId = tab.windowId;
    if (!acc[windowId]) {
      acc[windowId] = [];
    }
    console.log(tab.tabIndex, tab.url);
    acc[windowId][tab.tabIndex] = tab;
    return acc;
  }, {} as Record<string, ClientTabInfo[]>);
  return tabWindows;
}

interface TabItemProps {
  tab: ClientTabInfo;
  selected: boolean;
  onClick: () => void;
  settings: Setting | null;
}
function TabItem({
  tab,
  selected,
  onClick,
  settings,
}: TabItemProps) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function setNowInterval() {
      timeout = setTimeout(() => {
        setNow(Date.now());
        setNowInterval();
      }, 1000);
    }
    setNowInterval();
    return () => clearTimeout(timeout);
  }, []);
  if (!settings) {
    return null;
  }
  const closeRule = getURLSetting(settings, tab.url);
  const isLocked = closeRule.idleThreshold === 0 ||
    !closeRule.pinnedTabIgnore && tab.isPinned ||
    closeRule.unloadTabIgnore && tab.isUnloaded ||
    !closeRule.playingTabIgnore && tab.isAudible ||
    closeRule.containerTabIgnore && tab.groupId
    ;
  return (
    <button
      className={cn(
        "w-full flex items-center p-2 rounded-md group hover:bg-slate-100 transition-colors cursor-pointer",
        selected && "bg-slate-100",
      )}
      onClick={onClick}
    >
      <div className="relative mr-3">
        <div className="size-8 flex items-center justify-center bg-white rounded-md overflow-hidden shadow-sm">
          {tab.faviconUrl ? (
            <img
              src={tab.faviconUrl}
              alt=""
              className="size-5"
            />
          ) : (
            <span className="text-sm font-medium text-slate-700 size-5"></span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 mr-2">
        <div className="text-sm font-medium text-slate-900 truncate text-start">{tab.title}</div>
        <div className="flex items-center">
          <span className="text-xs text-slate-500 truncate">{tab.url}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Clock className="size-3 text-slate-400" />
        {closeRule ? (
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-full font-medium",
              isLocked ? "text-slate-400 bg-slate-100" : getTimeColor((tab.lastActiveAt + closeRule.idleThreshold * 60 * 1000 - Date.now()) / 1000, 600),
            )}
          >
            {isLocked ? "잠금" : formatRemainingTime(tab.lastActiveAt + closeRule.idleThreshold * 60 * 1000 - Date.now())}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export const CurrentTabs = () => {
  const [token] = useToken();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());
  const {
    tabs,
    closeTab,
    isLoading,
  } = useTabs();
  const {
    settings,
  } = useSetting();

  const filteredTabs = React.useDeferredValue(Object.fromEntries(Object.entries(tabs ?? {}).filter(([_, tabInfo]) => {
    return tabInfo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? true;
  })));

  React.useEffect(() => {
    setSelectedTabs(new Set());
  }, [searchQuery, tabs]);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      async function run() {
        if (!tabs || !settings) {
          return;
        }
        for (const [tabId, tabInfo] of Object.entries(tabs)) {
          const closeRule = getURLSetting(settings, tabInfo.url);
          const isOutdatedTab = closeRule.idleThreshold > 0 && tabInfo.lastActiveAt < Date.now() - 1000 * 60 * closeRule.idleThreshold;
          try {
            const tab = await browser.tabs.get(Number(tabId));
            if (isOutdatedTab && await isClosableTab(tab, settings)) {
              await Promise.all([
                browser.tabs.remove(tab.id!),
                saveTabIndexedDB(tab, tabInfo)
              ]);
            }
          } catch (error) {
            console.log("tab is closed", error);
            return;
          }
        }
      }
      run();
    }, 1000);
    return () => {
      clearInterval(intervalId);
    }
  }, [tabs]);
  const tabWindows = normalizeTabs(filteredTabs);
  const onClickCloseButton = () => {
    closeTab(Array.from(selectedTabs));
    setSelectedTabs(new Set());
  }
  if (!tabs) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm text-slate-500">탭을 불러오는 중...</span>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex flex-col mx-auto bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-2">
        <div className="flex items-center">
          <h2 className="text-lg font-medium mr-auto">현재 기기의 탭</h2>
          {token ? (
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-6 mr-2"
              disabled={selectedTabs.size === 0 || isLoading}
            >
              <span aria-hidden>탭 그룹</span>
              <ArchiveIcon className="size-4" />
              <span className="sr-only">선택한 탭 그룹으로 저장하기</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-6 mr-2"
            onClick={onClickCloseButton}
            disabled={selectedTabs.size === 0 || isLoading}
          >
            <XIcon className="size-4" /><span className="sr-only">닫기</span>
          </Button>
          {selectedTabs.size > 0 ? (
            <Badge variant="default" className="font-normal h-6">
              {selectedTabs.size} / {Object.keys(tabs).length} 탭
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal h-6">
              {Object.keys(tabs).length} 탭
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="탭 검색"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1 w-full h-full">
        <div className="p-2 w-[calc(100vw-var(--spacing)*2)] h-full">
          {Object.entries(tabWindows).map(([windowId, tabs]) => (
            <div key={windowId} className="h-full flex flex-col gap-2">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  settings={settings}
                  selected={selectedTabs.has(tab.id)}
                  onClick={() => setSelectedTabs((prev) => {
                    if (prev.has(tab.id)) {
                      prev.delete(tab.id);
                    } else {
                      prev.add(tab.id);
                    }
                    return new Set(prev);
                  })}
                />
              ))}
              <Separator className="my-1" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
