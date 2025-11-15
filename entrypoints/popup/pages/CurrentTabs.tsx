import type { ClientTabInfo } from "@/utils/Tab";
import type { Setting } from "@/types/data";


import React from "react";
import { browser } from 'wxt/browser';
import {
  ArchiveIcon,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Search,
  XIcon,
} from "lucide-react";
import { sendMessage } from "webext-bridge/popup";
import { Badge } from "@/entrypoints/components/ui/badge";
import { Input } from "@/entrypoints/components/ui/input";
import { Button } from "@/entrypoints/components/ui/button";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Separator } from "@/entrypoints/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/entrypoints/components/ui/dialog";
import { cn } from "@/utils";
import { isClosableTab, saveTabIndexedDB } from "@/utils/Tab";
import { getURLSetting } from "@/utils/Setting";
import { useSetting, useTabs, useToken } from "../hooks/useStorageValue";
import { generateSecretAndSaltFromPin } from "@/utils/crypto";
import ReactDOM from "react-dom";

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
  const isLocked = closeRule.idleTimeout === 0 ||
    !closeRule.allowPinnedTab && tab.isPinned ||
    closeRule.ignoreUnloadedTab && tab.isUnloaded ||
    !closeRule.ignoreAudibleTab && tab.isAudible ||
    closeRule.ignoreContainerTabs && tab.groupId
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
              isLocked ? "text-slate-400 bg-slate-100" : getTimeColor((tab.lastActiveAt + closeRule.idleTimeout * 60 * 1000 - Date.now()) / 1000, 600),
            )}
          >
            {isLocked ? "잠금" : formatRemainingTime(tab.lastActiveAt + closeRule.idleTimeout * 60 * 1000 - Date.now())}
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
  const [isPinDialogOpen, setIsPinDialogOpen] = React.useState(false);
  const [pinInputs, setPinInputs] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [showPinCode, setShowPinCode] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
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
          const isOutdatedTab = closeRule.idleTimeout > 0 && tabInfo.lastActiveAt < Date.now() - 1000 * 60 * closeRule.idleTimeout;
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

  const handlePinInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      // If pasting a complete PIN
      if (value.length === 6) {
        const newPinInputs = value.split("").slice(0, 6);
        setPinInputs(newPinInputs);
        // Focus the last input
        const lastInput = document.getElementById(`archive-pin-${5}`);
        if (lastInput) {
          lastInput.focus();
        }
      }
      return;
    }

    const newPinInputs = [...pinInputs];
    newPinInputs[index] = value;
    setPinInputs(newPinInputs);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`archive-pin-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to go to previous input
    if (e.key === "Backspace" && !pinInputs[index] && index > 0) {
      const prevInput = document.getElementById(`archive-pin-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  const onClickArchiveButton = () => {
    if (selectedTabs.size === 0) return;
    setPinInputs(["", "", "", "", "", ""]);
    setPinError(null);
    setIsPinDialogOpen(true);
  };

  const confirmArchive = async () => {
    const pinCode = pinInputs.join("");

    if (pinCode.length !== 6) {
      setPinError("6자리 PIN 코드를 입력해주세요.");
      return;
    }

    setIsArchiving(true);
    setPinError(null);

    try {
      // Generate secret and salt from PIN
      const { secret, salt } = await generateSecretAndSaltFromPin(pinCode);

      // Send to background script
      const result = await sendMessage(
        "send-tab-group",
        {
          tabIds: Array.from(selectedTabs, (id) => parseInt(id)),
          secret,
          salt,
        },
        "background"
      );

      if (result) {
        setSelectedTabs(new Set());
        setIsPinDialogOpen(false);
        setPinInputs(["", "", "", "", "", ""]);
      } else {
        setPinError("탭 그룹 아카이브에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("Failed to archive tab group:", error);
      setPinError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsArchiving(false);
    }
  };

  const onClickCloseButton = () => {
    closeTab(Array.from(selectedTabs));
    setSelectedTabs(new Set());
  };
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
              className="h-6 mr-2"
              onClick={onClickArchiveButton}
              disabled={selectedTabs.size === 0 || isLoading}
            >
              <ArchiveIcon className="size-4" />
              <span className="sr-only">선택한 탭 그룹으로 저장하기</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            className="h-6 mr-2"
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

      {/* PIN Code Dialog for Archiving */}
      {ReactDOM.createPortal((
        <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>탭 그룹 암호화</DialogTitle>
              <DialogDescription>
                선택한 탭들을 아카이브하기 위해 6자리 PIN 코드를 설정해주세요.
                이 PIN 코드는 나중에 탭 그룹을 복원할 때 필요합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col space-y-4 py-4">
              {pinError && <div className="text-sm font-medium text-red-500 text-center">{pinError}</div>}

              <div className="flex justify-center gap-2">
                {pinInputs.map((pin, index) => (
                  <Input
                    key={index}
                    id={`archive-pin-${index}`}
                    type={showPinCode ? "text" : "password"}
                    value={pin}
                    onChange={(e) => handlePinInputChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-10 h-12 text-center text-lg"
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={isArchiving}
                  />
                ))}
              </div>

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setShowPinCode(!showPinCode)}
                  disabled={isArchiving}
                >
                  {showPinCode ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span className="text-xs">PIN 숨기기</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span className="text-xs">PIN 보기</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPinDialogOpen(false)} disabled={isArchiving}>
                취소
              </Button>
              <Button onClick={confirmArchive} disabled={pinInputs.some((pin) => !pin) || isArchiving}>
                <Lock className="h-4 w-4 mr-2" />
                {isArchiving ? "아카이브 중..." : "아카이브"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
        document.body
      )}
    </div>
  );
}
