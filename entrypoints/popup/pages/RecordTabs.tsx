import type { RecordTabInfo, TabInfo } from "@/utils/Tab";

import React from "react";
import { Clock, ExternalLink, RotateCcw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Badge } from "@/entrypoints/components/ui/badge";
import { Button } from "@/entrypoints/components/ui/button";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Separator } from "@/entrypoints/components/ui/separator";
import { db } from "@/utils/db";
import { cn } from "@/utils";

function useRecordTabs(now: number) {
  const tabs = useLiveQuery(
    () => db.recordTabs
      .where("lastActiveAt")
      .aboveOrEqual(now - 30 * 24 * 60 * 60 * 1000)
      .toArray(),
    [now],
    [] as RecordTabInfo[],
  );
  return tabs;
}

export function RecordTabs() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  });
  const [selectedTabs, setSelectedTabs] = React.useState<string[]>([]);
  const closedTabs = useRecordTabs(now);

  const getFaviconFallback = (url: string) => {
    const domain = url.split("/")[0].replace("www.", "")
    return domain.charAt(0).toUpperCase()
  }

  const handleTabClick = (tabUrl: string, event: React.MouseEvent) => {
    // Prevent event from propagating to parent elements
    event.stopPropagation()

    if (selectedTabs.includes(tabUrl)) {
      setSelectedTabs(selectedTabs.filter((url) => url !== tabUrl))
    } else {
      setSelectedTabs([...selectedTabs, tabUrl])
    }
  }

  const handleTabDoubleClick = (tab: RecordTabInfo) => {
    // Restore single tab immediately
    restoreTab(tab)
  }

  const restoreTab = async (tab: RecordTabInfo) => {
    const currentWindow = await chrome.windows.getCurrent();
    chrome.tabs.create({
      url: tab.url,
      index: currentWindow.id === Number(tab.windowId) ? tab.tabIndex : undefined,
      windowId: currentWindow.id,
    });
  }

  const restoreSelectedTabs = () => {
    if (selectedTabs.length === 0) return
    selectedTabs.forEach((tabUrl) => {
      const tab = closedTabs.find((t) => t.url === tabUrl)
      if (tab) restoreTab(tab)
    })
    setSelectedTabs([])
  }
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">닫힌 탭</h2>
          <Badge variant="outline" className="font-normal">
            {closedTabs.length} 탭
          </Badge>
        </div>

        <div className="h-4 flex items-center justify-end">
          <Button
            size="sm"
            onClick={restoreSelectedTabs}
            className="w-full"
            disabled={selectedTabs.length === 0}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            선택한 탭 복원 ({selectedTabs.length})
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full h-full">
        <div className="p-2  w-[calc(100vw-var(--spacing)*2)] h-full">
          {closedTabs.length > 0 ? (
            closedTabs.map((tab) => {
              return (
                <div key={`${tab.windowId}-${tab.tabIndex}`}>
                  <div
                    className={cn(
                      "flex items-center p-2 rounded-md group transition-colors cursor-pointer",
                      selectedTabs.includes(tab.url) ? "bg-slate-100 hover:bg-slate-200" : "hover:bg-slate-50",
                    )}
                    onClick={(e) => handleTabClick(tab.url, e)}
                    onDoubleClick={() => handleTabDoubleClick(tab)}
                  >
                    <div className="w-8 h-8 flex items-center justify-center bg-white rounded-md overflow-hidden border shadow-sm mr-3">
                      {tab.faviconUrl ? (
                        <img
                          src={tab.faviconUrl || "/placeholder.svg"}
                          alt=""
                          className="w-5 h-5"
                          onError={(e) => {
                            ; (e.target as HTMLImageElement).style.display = "none"
                              ; (e.target as HTMLImageElement).nextSibling!.textContent = getFaviconFallback(tab.url)
                          }}
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0 mr-2">
                      <div className="text-sm font-medium text-slate-900 truncate">{tab.title}</div>
                      <div className="flex items-center">
                        <span className="text-xs text-slate-500 truncate">{tab.url}</span>
                        <ExternalLink className="h-3 w-3 text-slate-400 ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{formatTimeAgo(tab.lastActiveAt, now)}</span>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-1" />
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
              <p className="text-muted-foreground mb-2">닫힌 탭이 없습니다.</p>
              <p className="text-sm text-muted-foreground">탭이 닫히면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto'
})

const DIVISIONS = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' }
] as const;

function formatTimeAgo(date: number, now: number) {
  let duration = (date - now) / 1000

  for (let i = 0; i <= DIVISIONS.length; i++) {
    const division = DIVISIONS[i]
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name)
    }
    duration /= division.amount
  }
}
