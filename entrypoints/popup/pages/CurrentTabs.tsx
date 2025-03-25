import { Badge } from "@/entrypoints/components/ui/badge";
import { Input } from "@/entrypoints/components/ui/input";
import { Button } from "@/entrypoints/components/ui/button";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Separator } from "@/entrypoints/components/ui/separator";
import type { ClientTabInfo } from "@/types/data";
import { cn } from "@/utils";
import { Archive, Clock, Search, Settings } from "lucide-react";
import React from "react"
import { useSetting, useTabs } from "../hooks/useBackground";


const formatRemainingTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  } else {
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${seconds % 60}s`
  }
}

const getTimeColor = (minutes: number, limit: number) => {
  if (minutes / limit < 0.25) return "text-red-500 bg-red-50"
  if (minutes / limit < 0.5) return "text-amber-500 bg-amber-50"
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
  setting?: Setting;
}
function TabItem({
  tab,
  selected,
  onClick,
  setting,
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
  }, [now]);

  return (
    <div
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
      <div className="text-sm font-medium text-slate-900 truncate">{tab.title}</div>
      <div className="flex items-center">
        <span className="text-xs text-slate-500 truncate">{tab.url}</span>
      </div>
    </div>

    <div className="flex items-center gap-1 flex-shrink-0">
      <Clock className="size-3 text-slate-400" />
      <span
        className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", getTimeColor(tab.lastActiveAt, 60))}
      >
        {setting ? formatRemainingTime(tab.lastActiveAt + setting.closeRules.idleThreshold * 60 * 1000 - Date.now()) : "..."}
      </span>
    </div>
  </div>
  );
}

export const CurrentTabs = () => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());
  const tabs = useTabs();
  const setting = useSetting();
  const filteredTabs = React.useDeferredValue(Object.fromEntries(Object.entries(tabs).filter(([_, tabInfo]) => {
    return tabInfo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? true;
  })));
  const tabWindows = normalizeTabs(filteredTabs);
  React.useEffect(() => {
    setSelectedTabs(new Set());
  }, [searchQuery, tabs]);
  return (
    <div className="w-full h-full flex flex-col mx-auto bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-2">
        <div className="flex items-center">
          <h2 className="text-lg font-medium mr-auto">현재 기기의 탭</h2>
          {
            selectedTabs.size > 0 && (
              <Button variant="outline" size="icon" className="w-8 h-6 mr-2">
                <Archive className="size-4" />
              </Button>
            )
          }
          {selectedTabs.size > 0 ? (
            <Badge variant="default" className="font-normal h-6">
              {selectedTabs.size} / {Object.keys(tabs).length} tabs
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal h-6">
              {Object.keys(tabs).length} tabs
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
                  setting={setting}
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
