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
  Globe,
  Pin,
  Volume2,
  Layers,
  X,
} from "lucide-react";
import { sendMessage } from "webext-bridge/popup";
import { Badge } from "@/entrypoints/components/ui/badge";
import { Input } from "@/entrypoints/components/ui/input";
import { Button } from "@/entrypoints/components/ui/button";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Separator } from "@/entrypoints/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/entrypoints/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/entrypoints/components/ui/input-otp";
import { cn } from "@/utils";
import { isClosableTab, saveTabIndexedDB } from "@/utils/Tab";
import { getURLSetting } from "@/utils/Setting";
import { useSetting, useTabs, useToken } from "../hooks/useStorageValue";
import { generateSecretAndSaltFromPin } from "@/utils/crypto";
import { formatRemainingTime } from "@/utils/time";

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
  const [isHovered, setIsHovered] = React.useState(false);
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
    closeRule.ignoreContainerTab && tab.groupId
    ;

  const handleQuickClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await browser.tabs.remove(Number(tab.id));
    } catch (error) {
      console.error("Failed to close tab:", error);
    }
  };

  return (
    <button
      className={cn(
        "w-full flex items-center p-2 rounded-md group transition-all cursor-pointer border-2",
        selected
          ? "bg-blue-50 border-blue-300 shadow-sm"
          : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200",
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative mr-3">
        <div className="size-8 flex items-center justify-center bg-white rounded-md overflow-hidden shadow-sm border border-slate-200">
          {tab.faviconUrl ? (
            <img
              src={tab.faviconUrl}
              alt=""
              className="size-5"
            />
          ) : (
            <Globe className="size-4 text-slate-400" />
          )}
        </div>
        {selected && (
          <div className="absolute -top-1 -right-1 size-4 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-slate-900 truncate text-start">{tab.title || "제목 없음"}</span>
          {tab.isPinned && (
            <Pin className="size-3 text-blue-500 flex-shrink-0" />
          )}
          {tab.isAudible && (
            <Volume2 className="size-3 text-green-500 flex-shrink-0" />
          )}
          {tab.groupId !== "-1" && (
            <Layers className="size-3 text-purple-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center">
          <span className="text-xs text-slate-500 truncate">{tab.url}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isHovered && !selected ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-red-100 hover:text-red-600"
            onClick={handleQuickClose}
          >
            <X className="size-3.5" />
          </Button>
        ) : (
          <>
            <Clock className="size-3 text-slate-400" />
            {closeRule ? (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap",
                  isLocked ? "text-slate-400 bg-slate-100" : getTimeColor((tab.lastActiveAt + closeRule.idleTimeout * 60 * 1000 - Date.now()) / 1000, 600),
                )}
              >
                {isLocked ? "잠금" : formatRemainingTime(tab.lastActiveAt + closeRule.idleTimeout * 60 * 1000 - Date.now())}
              </span>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}

export const CurrentTabs = () => {
  const [token] = useToken();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());
  const [isPinDialogOpen, setIsPinDialogOpen] = React.useState(false);
  const [pinValue, setPinValue] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [archiveSuccess, setArchiveSuccess] = React.useState(false);
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

  const onClickArchiveButton = () => {
    if (selectedTabs.size === 0) return;
    setPinValue("");
    setPinError(null);
    setArchiveSuccess(false);
    setIsPinDialogOpen(true);
  };

  const confirmArchive = async () => {
    if (pinValue.length !== 6) {
      setPinError("6자리 PIN 코드를 입력해주세요.");
      return;
    }

    setIsArchiving(true);
    setPinError(null);

    try {
      // Generate secret and salt from PIN
      const { secret, salt } = await generateSecretAndSaltFromPin(pinValue);

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
        setArchiveSuccess(true);
        setSelectedTabs(new Set());

        // Auto close dialog after success
        setTimeout(() => {
          setIsPinDialogOpen(false);
          setArchiveSuccess(false);
          setPinValue("");
        }, 1500);
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
          {Object.keys(filteredTabs).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                {searchQuery ? (
                  <Search className="size-8 text-slate-400" />
                ) : (
                  <Eye className="size-8 text-slate-400" />
                )}
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchQuery ? "검색 결과 없음" : "열린 탭이 없습니다"}
              </h3>
              <p className="text-sm text-slate-500 text-center max-w-xs">
                {searchQuery
                  ? `"${searchQuery}"와 일치하는 탭을 찾을 수 없습니다`
                  : "새 탭을 열어보세요"}
              </p>
            </div>
          ) : (
            Object.entries(tabWindows).map(([windowId, tabs]) => (
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
            ))
          )}
        </div>
      </ScrollArea>

      {/* PIN Code Dialog for Archiving */}
      <Dialog open={isPinDialogOpen} onOpenChange={(open) => {
        if (!isArchiving) {
          setIsPinDialogOpen(open);
          if (!open) {
            setPinValue("");
            setPinError(null);
            setArchiveSuccess(false);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>탭 그룹 암호화</DialogTitle>
            <DialogDescription>
              {archiveSuccess
                ? "탭 그룹이 성공적으로 아카이브되었습니다!"
                : "선택한 탭들을 아카이브하기 위해 6자리 PIN 코드를 설정해주세요. 이 PIN 코드는 나중에 탭 그룹을 복원할 때 필요합니다."
              }
            </DialogDescription>
          </DialogHeader>

          {archiveSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Lock className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {selectedTabs.size}개의 탭이 안전하게 저장되었습니다
              </p>
            </div>
          ) : (
            <div className="flex flex-col space-y-6 py-4">
              {pinError && (
                <div className="text-sm font-medium text-red-500 text-center bg-red-50 py-2 px-4 rounded-md">
                  {pinError}
                </div>
              )}

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={pinValue}
                  onChange={setPinValue}
                  disabled={isArchiving}
                  onComplete={confirmArchive}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                {pinValue.length}/6 자리 입력됨
              </p>
            </div>
          )}

          {!archiveSuccess && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPinDialogOpen(false)}
                disabled={isArchiving}
              >
                취소
              </Button>
              <Button
                onClick={confirmArchive}
                disabled={pinValue.length !== 6 || isArchiving}
              >
                {isArchiving ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    아카이브 중...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    아카이브
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
