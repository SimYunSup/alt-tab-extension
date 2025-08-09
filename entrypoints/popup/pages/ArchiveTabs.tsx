import React from "react";
import { ClientTabInfo } from "@/utils/Tab";
import { Button } from "@/entrypoints/components/ui/button";
import { Login } from "@/entrypoints/components/Login";
import { Badge } from "@/entrypoints/components/ui/badge";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/entrypoints/components/ui/card";
import { useToken } from "@/entrypoints/popup/hooks/useStorageValue";
import { cn } from "@/utils";
import { Clock, Eye, EyeOff, FolderLock, FolderOpen, Lock, QrCode, Trash, Unlock } from "lucide-react";
import { Separator } from "@/entrypoints/components/ui/separator";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/entrypoints/components/ui/dialog";
import { Input } from "@/entrypoints/components/ui/input";
import ReactDOM from "react-dom";

interface TabGroup {
  id: string
  createdAt: number
  tabs: ClientTabInfo[];
  pinCode: string // In a real app, this would be encrypted/hashed
}

// TODO:
export function ArchiveTabs() {
  const [token] = useToken();

  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null)
  const [isPinDialogOpen, setIsPinDialogOpen] = React.useState(false)
  const [pinInputs, setPinInputs] = React.useState<string[]>(["", "", "", "", "", ""])
  const [pinError, setPinError] = React.useState<string | null>(null)
  const [unlockedGroups, setUnlockedGroups] = React.useState<string[]>([])
  const [showPinCode, setShowPinCode] = React.useState(false)

  // Sample data for tab groups
  const [tabGroups, setTabGroups] = React.useState<TabGroup[]>([
    {
      id: "group1",
      createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      pinCode: "123456", // In a real app, this would be encrypted/hashed
      tabs: [
        {
          tabIndex: 0,
          windowId: "123123",
          id: "1",
          title: "Jira | Your work",
          url: "jira.company.com/your-work",
          faviconUrl: "https://wac-cdn.atlassian.com/assets/img/favicons/jira/favicon.png",
          lastActiveAt: Date.now() - 1000 * 60 * 30,
        },
        {
          tabIndex: 1,
          windowId: "123123",
          id: "2",
          title: "Confluence - Company Wiki",
          url: "confluence.company.com/wiki",
          faviconUrl: "https://wac-cdn.atlassian.com/assets/img/favicons/confluence/favicon.png",
          lastActiveAt: Date.now() - 1000 * 60 * 45,
        },
        {
          tabIndex: 2,
          windowId: "123123",
          id: "3",
          title: "Slack | General",
          url: "app.slack.com/client",
          faviconUrl: "https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png",
          lastActiveAt: Date.now() - 1000 * 60 * 15,
        },
      ],
    },
    {
      id: "group2",
      createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      pinCode: "567890", // In a real app, this would be encrypted/hashed
      tabs: [
        {
          tabIndex: 0,
          windowId: "123123",
          id: "4",
          title: "GitHub - My Project",
          url: "github.com/user/project",
          faviconUrl: "https://github.githubassets.com/favicons/favicon.svg",
          lastActiveAt: Date.now() - 1000 * 60 * 60,
        },
        {
          tabIndex: 1,
          windowId: "123123",
          id: "5",
          title: "Vercel - Deployments",
          url: "vercel.com/dashboard",
          faviconUrl: "https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico",
          lastActiveAt: Date.now() - 1000 * 60 * 90,
        },
      ],
    },
  ])

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)

    if (seconds < 60) return `${seconds}초 전`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}분 전`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}시간 전`

    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}일 전`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months}개월 전`

    const years = Math.floor(months / 12)
    return `${years}년 전`
  }

  const getFaviconFallback = (url: string) => {
    const domain = url.split("/")[0].replace("www.", "")
    return domain.charAt(0).toUpperCase()
  }

  const handleGroupClick = (groupId: string) => {
    // If already unlocked, just toggle selection
    if (unlockedGroups.includes(groupId)) {
      setSelectedGroupId(selectedGroupId === groupId ? null : groupId)
      return
    }

    // Otherwise, prompt for PIN
    setSelectedGroupId(groupId)
    setPinInputs(["", "", "", "", "", ""])
    setPinError(null)
    setIsPinDialogOpen(true)
  }

  const handlePinInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      // If pasting a complete PIN
      if (value.length === 6) {
        const newPinInputs = value.split("").slice(0, 6)
        setPinInputs(newPinInputs)
        // Focus the last input
        const lastInput = document.getElementById(`unlock-pin-${5}`)
        if (lastInput) {
          lastInput.focus()
        }
      }
      return
    }

    const newPinInputs = [...pinInputs]
    newPinInputs[index] = value
    setPinInputs(newPinInputs)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`unlock-pin-${index + 1}`)
      if (nextInput) {
        nextInput.focus()
      }
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to go to previous input
    if (e.key === "Backspace" && !pinInputs[index] && index > 0) {
      const prevInput = document.getElementById(`unlock-pin-${index - 1}`)
      if (prevInput) {
        prevInput.focus()
      }
    }
  }

  const verifyPin = () => {
    const enteredPin = pinInputs.join("")
    const group = tabGroups.find((g) => g.id === selectedGroupId)

    if (group && enteredPin === group.pinCode) {
      // PIN is correct
      setUnlockedGroups([...unlockedGroups, group.id])
      setIsPinDialogOpen(false)
      setPinError(null)
    } else {
      // PIN is incorrect
      setPinError("잘못된 PIN 코드입니다. 다시 시도해주세요.")
      setPinInputs(["", "", "", "", "", ""])
      // Focus the first input
      const firstInput = document.getElementById("unlock-pin-0")
      if (firstInput) {
        firstInput.focus()
      }
    }
  }

  const lockGroup = (groupId: string) => {
    setUnlockedGroups(unlockedGroups.filter((id) => id !== groupId))
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null)
    }
  }

  const restoreAllTabs = (groupId: string) => {
    const group = tabGroups.find((g) => g.id === groupId)
    if (group) {
      // TODO: Implement actual tab restoration logic
    }
  }
  if (!token) {
    return <Login />
  }
  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">아카이브된 탭 그룹</h2>
          <Badge variant="outline" className="font-normal">
            {tabGroups.length} 그룹
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-2 grid gap-4">
          {tabGroups.map((group) => (
            <Card
              onClick={() => handleGroupClick(group.id)}
              key={group.id}
              className={cn(
                "cursor-pointer transition-all",
                selectedGroupId === group.id && unlockedGroups.includes(group.id)
                  ? "ring-2 ring-primary"
                  : "hover:shadow-md",
              )}
            >
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {unlockedGroups.includes(group.id) ? (
                      <FolderOpen className="h-5 w-5 mb-auto text-primary" />
                    ) : (
                      <FolderLock className="h-5 w-5 mb-auto text-muted-foreground" />
                    )}
                    <CardTitle className="flex flex-row text-md font-normal">
                      <span>
                        {formatTimeAgo(group.createdAt)} 생성 /&nbsp;
                        {group.tabs.length}개 탭
                      </span>
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-1">
                    {unlockedGroups.includes(group.id) && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <QrCode className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            lockGroup(group.id)
                          }}
                        >
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Trash className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-1 text-xs">
                </CardDescription>
              </CardHeader>

              {selectedGroupId === group.id && unlockedGroups.includes(group.id) && (
                <>
                  <CardContent className="pt-0">
                    <Separator className="my-2" />
                    <div className="space-y-2 mt-2">
                      {group.tabs.map((tab) => (
                        <div
                          key={tab.id}
                          className="flex items-center p-2 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-7 h-7 flex items-center justify-center bg-white rounded-md overflow-hidden border shadow-sm mr-3">
                            {tab.faviconUrl ? (
                              <img
                                src={tab.faviconUrl || "/placeholder.svg"}
                                alt=""
                                className="w-4 h-4"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).nextSibling!.textContent = getFaviconFallback(tab.url);
                                }}
                              />
                            ) : (
                              <span className="text-xs font-medium text-slate-700">{getFaviconFallback(tab.url)}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 mr-2">
                            <div className="text-sm font-medium text-slate-900 truncate">{tab.title}</div>
                            <div className="flex items-center">
                              <span className="text-xs text-slate-500 truncate">{tab.url}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-500">{formatTimeAgo(tab.lastActiveAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => restoreAllTabs(group.id)}>
                      <FolderOpen className="h-4 w-4 mr-2" />
                      모든 탭 복원
                    </Button>
                  </CardFooter>
                </>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* PIN Code Dialog */}
      {ReactDOM.createPortal((
        <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>PIN 코드 입력</DialogTitle>
              <DialogDescription>암호화된 탭 그룹을 열기 위해 6자리 PIN 코드를 입력해주세요.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col space-y-4 py-4">
              {pinError && <div className="text-sm font-medium text-red-500 text-center">{pinError}</div>}

              <div className="flex justify-center gap-2">
                {pinInputs.map((pin, index) => (
                  <Input
                    key={index}
                    id={`unlock-pin-${index}`}
                    type={showPinCode ? "text" : "password"}
                    value={pin}
                    onChange={(e) => handlePinInputChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-10 h-12 text-center text-lg"
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                ))}
              </div>

              <div className="flex justify-center">
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setShowPinCode(!showPinCode)}>
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
              <Button variant="outline" onClick={() => setIsPinDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={verifyPin} disabled={pinInputs.some((pin) => !pin)}>
                <Unlock className="h-4 w-4 mr-2" />
                잠금 해제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
        document.body
      )}
    </div>
  )
}
