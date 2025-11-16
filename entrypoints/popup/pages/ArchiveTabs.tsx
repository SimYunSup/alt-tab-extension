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
import { Clock, Eye, EyeOff, FolderLock, FolderOpen, Lock, QrCode, Trash, Unlock, Copy, Check } from "lucide-react";
import { Separator } from "@/entrypoints/components/ui/separator";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/entrypoints/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/entrypoints/components/ui/input-otp";
import { getArchivedTabGroups, deleteTabGroup, generateQRCode, type TabGroupResponse } from "@/utils/ArchivedTabGroup";
import { verifyPinCode } from "@/utils/crypto";
import { formatTimeAgo } from "@/utils/time";
import QRCode from "qrcode";

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
  const [qrShareUrl, setQrShareUrl] = React.useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

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

    try {
      // Get share URL from backend
      const shareUrl = await generateQRCode(groupId);

      if (!shareUrl) {
        alert("공유 URL 생성에 실패했습니다.");
        return;
      }

      setQrShareUrl(shareUrl);

      // Generate QR code image on client side
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      setQrCodeUrl(qrDataUrl);
      setIsQrDialogOpen(true);
      setIsCopied(false);
    } catch (error) {
      console.error("QR code generation failed:", error);
      alert("QR 코드 생성에 실패했습니다.");
    }
  };

  const copyShareUrl = async () => {
    if (!qrShareUrl) return;

    try {
      await navigator.clipboard.writeText(qrShareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
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
            <div className="flex flex-col items-center justify-center py-12">
              <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FolderLock className="size-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">아카이브된 탭 그룹이 없습니다</h3>
              <p className="text-sm text-slate-500 text-center max-w-xs">
                현재 탭에서 탭을 선택하고 아카이브 버튼을 눌러 저장하세요
              </p>
            </div>
          ) : (
            tabGroups.map((group) => (
              <Card
                onClick={() => handleGroupClick(group.id)}
                key={group.id}
                className={cn(
                  "cursor-pointer transition-all border-slate-200",
                  selectedGroupId === group.id && unlockedGroups.includes(group.id)
                    ? "ring-2 ring-primary shadow-lg"
                    : "hover:shadow-md hover:border-slate-300"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        unlockedGroups.includes(group.id)
                          ? "bg-primary/10"
                          : "bg-slate-100"
                      )}>
                        {unlockedGroups.includes(group.id) ? (
                          <FolderOpen className="h-5 w-5 text-primary" />
                        ) : (
                          <FolderLock className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {group.browserTabInfos.length}개의 탭
                        </CardTitle>
                        <CardDescription className="text-xs mt-1 text-slate-500">
                          {(() => {
                            const domains = group.browserTabInfos.map(tab => {
                              try {
                                return new URL(tab.url).hostname.replace("www.", "");
                              } catch {
                                return tab.url;
                              }
                            });
                            const uniqueDomains = [...new Set(domains)];
                            if (uniqueDomains.length <= 3) {
                              return uniqueDomains.join(", ");
                            }
                            return `${uniqueDomains.slice(0, 2).join(", ")} 외 ${uniqueDomains.length - 2}개`;
                          })()}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                        onClick={(e) => handleGenerateQR(group.id, e)}
                        title="QR 코드로 공유"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {unlockedGroups.includes(group.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            lockGroup(group.id);
                          }}
                          title="잠금"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => handleDeleteGroup(group.id, e)}
                        title="삭제"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Preview of tabs (collapsed view) */}
                  {!unlockedGroups.includes(group.id) && (
                    <div className="mt-3 flex items-center gap-1">
                      {group.browserTabInfos.slice(0, 5).map((tab, index) => (
                        <div
                          key={index}
                          className="w-6 h-6 flex items-center justify-center bg-white rounded border shadow-sm"
                          title={tab.title}
                        >
                          {tab.faviconUrl ? (
                            <img
                              src={tab.faviconUrl}
                              alt=""
                              className="w-4 h-4"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-[10px] font-medium text-slate-600">
                              {getFaviconFallback(tab.url)}
                            </span>
                          )}
                        </div>
                      ))}
                      {group.browserTabInfos.length > 5 && (
                        <span className="text-xs text-slate-500 ml-1">
                          +{group.browserTabInfos.length - 5}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        클릭하여 잠금 해제
                      </span>
                    </div>
                  )}
                </CardHeader>

                {selectedGroupId === group.id && unlockedGroups.includes(group.id) && (
                  <>
                    <CardContent className="pt-0">
                      <Separator className="mb-3" />
                      <div className="space-y-1">
                        {group.browserTabInfos.map((tab, index) => (
                          <div
                            key={index}
                            className="flex items-center p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                          >
                            <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg overflow-hidden border shadow-sm mr-3 flex-shrink-0">
                              {tab.faviconUrl ? (
                                <img
                                  src={tab.faviconUrl || "/placeholder.svg"}
                                  alt=""
                                  className="w-5 h-5"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                    const fallback = (e.target as HTMLImageElement).nextSibling;
                                    if (fallback) {
                                      (fallback as HTMLElement).textContent = getFaviconFallback(tab.url);
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-semibold text-slate-600">
                                  {getFaviconFallback(tab.url)}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 mr-3">
                              <div className="text-sm font-medium text-slate-900 truncate group-hover:text-primary transition-colors">
                                {tab.title}
                              </div>
                              <div className="text-xs text-slate-500 truncate">{tab.url}</div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0 bg-slate-100 px-2 py-1 rounded-full">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-600">{formatTimeAgo(tab.lastActiveAt * 1000)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button
                        variant="default"
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
                            <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            복원 중...
                          </>
                        ) : (
                          <>
                            <FolderOpen className="h-4 w-4 mr-2" />
                            모든 탭 복원하기
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
                onChange={(value) => setPinValue(value.replace(/[^0-9]/g, ""))}
                disabled={isVerifying}
                onComplete={verifyPin}
                pattern="[0-9]*"
                inputMode="numeric"
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
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR 코드로 공유
            </DialogTitle>
            <DialogDescription>
              QR 코드를 스캔하거나 링크를 복사하여 공유하세요.
              <br />
              <span className="text-amber-600 font-medium">이 링크는 10분간 유효합니다.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeUrl ? (
              <div className="bg-white p-4 rounded-lg shadow-inner border">
                <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56" />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {qrShareUrl && (
              <div className="w-full">
                <label className="text-xs font-medium text-slate-500 mb-1 block">공유 링크</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qrShareUrl}
                    readOnly
                    className="flex-1 text-xs bg-slate-50 border rounded-md px-3 py-2 text-slate-600 truncate"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyShareUrl}
                    className="flex-shrink-0"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-1 text-green-600" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        복사
                      </>
                    )}
                  </Button>
                </div>
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
