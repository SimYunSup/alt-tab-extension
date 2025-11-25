import React from "react";
import { browser } from 'wxt/browser';
import { Button } from "@/entrypoints/components/ui/button";
import { Login } from "@/entrypoints/components/Login";
import { Badge } from "@/entrypoints/components/ui/badge";
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/entrypoints/components/ui/card";
import { useToken } from "@/entrypoints/popup/hooks/useStorageValue";
import { cn } from "@/utils";
import { FolderOpen, QrCode, Trash } from "lucide-react";
import { getArchivedTabGroups, deleteTabGroup, generateQRCode, type TabGroupResponse } from "@/utils/ArchivedTabGroup";
import { getWebAppUrl } from "@/utils/web";
export function ArchiveTabs() {
  const [token] = useToken();

  const [tabGroups, setTabGroups] = React.useState<TabGroupResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
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
    setSelectedGroupId(selectedGroupId === groupId ? null : groupId);
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("이 탭 그룹을 삭제하시겠습니까?")) {
      return;
    }

    const success = await deleteTabGroup(groupId);

    if (success) {
      setTabGroups(tabGroups.filter((g) => g.id !== groupId));
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

      // Extract the tab group ID from the share URL
      const url = new URL(shareUrl);
      const tabGroupId = url.searchParams.get('id') || url.pathname.split('/').pop();

      // Open the embedded web app with the tab group ID
      const webAppUrl = getWebAppUrl(`?id=${tabGroupId}`);
      await browser.tabs.create({
        url: webAppUrl,
        active: true,
      });
    } catch (error) {
      console.error("QR code generation failed:", error);
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
        <div className="px-4 py-2 grid gap-1 w-full">
          {tabGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FolderOpen className="size-8 text-slate-400" />
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
                  "cursor-pointer transition-all border-slate-200 gap-3",
                  selectedGroupId === group.id
                    ? "ring-2 ring-primary shadow-lg"
                    : "hover:shadow-md hover:border-slate-300"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FolderOpen className="h-5 w-5 text-primary" />
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
                </CardHeader>

                {selectedGroupId === group.id && (
                  <>
                    <CardContent className="pt-0">
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
    </div>
  );
}
