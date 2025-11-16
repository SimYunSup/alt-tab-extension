import React from "react";
import { browser } from 'wxt/browser';
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/entrypoints/components/ui/input-otp";
import { getArchivedTabGroups, deleteTabGroup, generateQRCode, type TabGroupResponse } from "@/utils/ArchivedTabGroup";
import { verifyPinCode } from "@/utils/crypto";
import { formatTimeAgo } from "@/utils/time";

export function ArchiveTabs() {
  const [token] = useToken();

  const [tabGroups, setTabGroups] = React.useState<TabGroupResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = React.useState(false);
  const [pinValue, setPinValue] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [unlockedGroups, setUnlockedGroups] = React.useState<string[]>([]);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);

  // Load archived tab groups on mount
  React.useEffect(() => {
    if (token) {
      loadTabGroups();
    }
  }, [token]);

  const loadTabGroups = async () => {
    setIsLoading(true);
    try {
      const groups = await getArchivedTabGroups();
      setTabGroups(groups);
    } catch (error) {
      console.error("Failed to load archived tab groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFaviconFallback = (url: string) => {
    const domain = url.split("/")[0].replace("www.", "");
    return domain.charAt(0).toUpperCase();
  };

  const handleGroupClick = (groupId: string) => {
    // If already unlocked, just toggle selection
    if (unlockedGroups.includes(groupId)) {
      setSelectedGroupId(selectedGroupId === groupId ? null : groupId);
      return;
    }

    // Otherwise, prompt for PIN
    setSelectedGroupId(groupId);
    setPinValue("");
    setPinError(null);
    setIsPinDialogOpen(true);
  };

  const verifyPin = async () => {
    if (pinValue.length !== 6) {
      setPinError("6자리 PIN 코드를 입력해주세요.");
      return;
    }

    const group = tabGroups.find((g) => g.id === selectedGroupId);

    if (!group) {
      setPinError("탭 그룹을 찾을 수 없습니다.");
      return;
    }

    setIsVerifying(true);
    setPinError(null);

    try {
      // Verify PIN using stored secret and salt
      const isValid = await verifyPinCode(pinValue, group.secret, group.salt);

      if (isValid) {
        // PIN is correct
        setUnlockedGroups([...unlockedGroups, group.id]);
        setIsPinDialogOpen(false);
        setPinValue("");
      } else {
        // PIN is incorrect
        setPinError("잘못된 PIN 코드입니다. 다시 시도해주세요.");
        setPinValue("");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      setPinError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsVerifying(false);
    }
  };

  const lockGroup = (groupId: string) => {
    setUnlockedGroups(unlockedGroups.filter((id) => id !== groupId));
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("이 탭 그룹을 삭제하시겠습니까?")) {
      return;
    }

    const success = await deleteTabGroup(groupId);

    if (success) {
      setTabGroups(tabGroups.filter((g) => g.id !== groupId));
      setUnlockedGroups(unlockedGroups.filter((id) => id !== groupId));
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
      }
    } else {
      alert("탭 그룹 삭제에 실패했습니다.");
    }
  };

  const handleGenerateQR = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const url = await generateQRCode(groupId);

    if (url) {
      setQrCodeUrl(url);
      setIsQrDialogOpen(true);
    } else {
      alert("QR 코드 생성에 실패했습니다.");
    }
  };

  const restoreAllTabs = async (groupId: string) => {
    const group = tabGroups.find((g) => g.id === groupId);
    if (!group) return;

    setIsRestoring(true);

    try {
      // Open all tabs in the group
      for (const tab of group.browserTabInfos) {
        await browser.tabs.create({
          url: tab.url,
          pinned: tab.isPinned,
          active: false,
        });
      }

      // Show success feedback
      setTimeout(() => setIsRestoring(false), 1000);
    } catch (error) {
      console.error("Failed to restore tabs:", error);
      alert("탭 복원에 실패했습니다.");
      setIsRestoring(false);
    }
  };

  if (!token) {
    return <Login />;
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm text-slate-500">아카이브된 탭 그룹을 불러오는 중...</span>
      </div>
    );
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
          {tabGroups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500">아카이브된 탭 그룹이 없습니다.</p>
            </div>
          ) : (
            tabGroups.map((group) => (
              <Card
                onClick={() => handleGroupClick(group.id)}
                key={group.id}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedGroupId === group.id && unlockedGroups.includes(group.id)
                    ? "ring-2 ring-primary"
                    : "hover:shadow-md"
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
                          {group.browserTabInfos.length}개 탭
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
                            onClick={(e) => handleGenerateQR(group.id, e)}
                          >
                            <QrCode className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              lockGroup(group.id);
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
                        onClick={(e) => handleDeleteGroup(group.id, e)}
                      >
                        <Trash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs"></CardDescription>
                </CardHeader>

                {selectedGroupId === group.id && unlockedGroups.includes(group.id) && (
                  <>
                    <CardContent className="pt-0">
                      <Separator className="my-2" />
                      <div className="space-y-2 mt-2">
                        {group.browserTabInfos.map((tab, index) => (
                          <div
                            key={index}
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
                                    const fallback = (e.target as HTMLImageElement).nextSibling;
                                    if (fallback) {
                                      (fallback as HTMLElement).textContent = getFaviconFallback(tab.url);
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-medium text-slate-700">
                                  {getFaviconFallback(tab.url)}
                                </span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreAllTabs(group.id);
                        }}
                        disabled={isRestoring}
                      >
                        {isRestoring ? (
                          <>
                            <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            복원 중...
                          </>
                        ) : (
                          <>
                            <FolderOpen className="h-4 w-4 mr-2" />
                            모든 탭 복원
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* PIN Code Dialog */}
      <Dialog open={isPinDialogOpen} onOpenChange={(open) => {
        if (!isVerifying) {
          setIsPinDialogOpen(open);
          if (!open) {
            setPinValue("");
            setPinError(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PIN 코드 입력</DialogTitle>
            <DialogDescription>
              암호화된 탭 그룹을 열기 위해 6자리 PIN 코드를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

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
                disabled={isVerifying}
                onComplete={verifyPin}
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPinDialogOpen(false)}
              disabled={isVerifying}
            >
              취소
            </Button>
            <Button
              onClick={verifyPin}
              disabled={pinValue.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  확인 중...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  잠금 해제
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR 코드로 공유</DialogTitle>
            <DialogDescription>이 QR 코드는 10분간 유효합니다.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-slate-100">
                <span className="text-sm text-slate-500">QR 코드를 불러오는 중...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQrDialogOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
