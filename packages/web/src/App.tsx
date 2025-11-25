import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { verifyPinCode, deriveKeyFromPin, decryptSensitiveData } from "@/lib/crypto";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ExternalLink,
  RefreshCw,
  Share2,
  Copy,
  Check,
} from "lucide-react";

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

interface BrowserTabInfo {
  url: string;
  title: string;
  faviconUrl?: string;
  scrollPosition?: { x: number; y: number };
  session?: string;   // Encrypted session storage data
  cookie?: string;    // Encrypted cookie data
  local?: string;     // Encrypted local storage data
}

interface TabGroupData {
  id: string;
  secret: string;
  salt: string;
  browserTabInfos: BrowserTabInfo[];
}

// Decrypted tab info for restoration
interface DecryptedTabInfo {
  url: string;
  title: string;
  faviconUrl?: string;
  scrollPosition?: { x: number; y: number };
  session?: string;   // Decrypted session storage data
  cookie?: string;    // Decrypted cookie data
  local?: string;     // Decrypted local storage data
}

type AppState =
  | "loading"
  | "no_id"
  | "checking_extension"
  | "extension_not_found"
  | "pin_input"
  | "verifying"
  | "restoring"
  | "success"
  | "error";

function App() {
  const [state, setState] = useState<AppState>("loading");
  const [tabGroupData, setTabGroupData] = useState<TabGroupData | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [restoredCount, setRestoredCount] = useState(0);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get current URL for sharing
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
    }
  };

  // Parse URL to get tab group ID
  useEffect(() => {
    // Support both query parameter (?id=xxx) and path parameter (/tab-group/xxx)
    const params = new URLSearchParams(window.location.search);
    let id = params.get("id");

    // If no query parameter, try to extract from path
    if (!id) {
      const pathMatch = window.location.pathname.match(/\/tab-group\/([^\/]+)/);
      if (pathMatch) {
        id = pathMatch[1];
      }
    }

    if (!id) {
      setState("no_id");
      return;
    }

    fetchTabGroupData(id);
  }, []);

  // Fetch tab group data from server
  const fetchTabGroupData = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tab-group/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setErrorMessage("탭 그룹을 찾을 수 없거나 만료되었습니다.");
        } else {
          setErrorMessage("서버 오류가 발생했습니다.");
        }
        setState("error");
        return;
      }

      const data = await response.json() as TabGroupData;
      setTabGroupData(data);
      checkExtension();
    } catch (error) {
      console.error("Failed to fetch tab group:", error);
      setErrorMessage("서버에 연결할 수 없습니다.");
      setState("error");
    }
  };

  // Check if extension is installed
  const checkExtension = () => {
    setState("checking_extension");
    let responseReceived = false;

    // Listen for response from extension content script
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source !== "alt-tab-extension") return;

      if (event.data.type === "pong" && event.data.data?.success) {
        responseReceived = true;
        setExtensionDetected(true);
        setState("pin_input");
        window.removeEventListener("message", messageHandler);
      }
    };

    window.addEventListener("message", messageHandler);

    // Send ping to extension via postMessage (handled by content script)
    window.postMessage(
      {
        source: "alt-tab-web",
        type: "ping",
      },
      "*"
    );

    // Timeout fallback - if no response, extension not installed
    setTimeout(() => {
      if (!responseReceived) {
        setExtensionDetected(false);
        setState("extension_not_found");
        window.removeEventListener("message", messageHandler);
      }
    }, 2000);
  };

  // Verify PIN and restore tabs
  const handleVerifyPin = async () => {
    if (pinValue.length !== 6 || !tabGroupData) {
      setPinError("6자리 PIN 코드를 입력해주세요.");
      return;
    }

    setState("verifying");
    setPinError(null);

    try {
      const isValid = await verifyPinCode(pinValue, tabGroupData.secret, tabGroupData.salt);

      if (!isValid) {
        setPinError("잘못된 PIN 코드입니다. 다시 시도해주세요.");
        setPinValue("");
        setState("pin_input");
        return;
      }

      // PIN is correct, derive decryption key and decrypt tab data
      console.log("[Web] PIN verified, deriving decryption key...");
      const decryptionKey = await deriveKeyFromPin(pinValue, tabGroupData.salt);

      // Decrypt all tab data
      console.log("[Web] Decrypting tab data for", tabGroupData.browserTabInfos.length, "tabs...");
      const decryptedTabs: DecryptedTabInfo[] = await Promise.all(
        tabGroupData.browserTabInfos.map(async (tab) => {
          const decryptedTab: DecryptedTabInfo = {
            url: tab.url,
            title: tab.title,
            faviconUrl: tab.faviconUrl,
            scrollPosition: tab.scrollPosition,
          };

          // Decrypt sensitive data if present
          if (tab.session) {
            try {
              decryptedTab.session = await decryptSensitiveData(tab.session, decryptionKey);
            } catch (e) {
              console.warn("[Web] Failed to decrypt session for", tab.url, e);
              decryptedTab.session = "{}";
            }
          }
          if (tab.cookie) {
            try {
              decryptedTab.cookie = await decryptSensitiveData(tab.cookie, decryptionKey);
            } catch (e) {
              console.warn("[Web] Failed to decrypt cookies for", tab.url, e);
              decryptedTab.cookie = "[]";
            }
          }
          if (tab.local) {
            try {
              decryptedTab.local = await decryptSensitiveData(tab.local, decryptionKey);
            } catch (e) {
              console.warn("[Web] Failed to decrypt local storage for", tab.url, e);
              decryptedTab.local = "{}";
            }
          }

          return decryptedTab;
        })
      );
      console.log("[Web] Decryption complete");

      // Restore tabs with decrypted data
      if (extensionDetected) {
        setState("restoring");

        // Listen for response from extension
        const restoreHandler = (event: MessageEvent) => {
          if (event.data?.source !== "alt-tab-extension") return;

          if (event.data.type === "restore_tabs_response") {
            if (event.data.data?.success) {
              setRestoredCount(event.data.data.count || tabGroupData.browserTabInfos.length);
              setState("success");
            } else {
              setErrorMessage("탭 복원에 실패했습니다.");
              setState("error");
            }
            window.removeEventListener("message", restoreHandler);
          }
        };

        window.addEventListener("message", restoreHandler);

        // Send restore request to extension via postMessage with decrypted data
        window.postMessage(
          {
            source: "alt-tab-web",
            type: "restore_tabs",
            data: {
              tabs: decryptedTabs,
            },
          },
          "*"
        );

        // Simple timeout fallback (5 seconds - response should be immediate now)
        setTimeout(() => {
          window.removeEventListener("message", restoreHandler);
        }, 5000);
      } else {
        // No extension, open tabs directly in browser (without cookie/storage restoration)
        setState("restoring");
        let count = 0;
        for (const tab of decryptedTabs) {
          window.open(tab.url, "_blank");
          count++;
        }
        setRestoredCount(count);
        setState("success");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      setPinError("오류가 발생했습니다. 다시 시도해주세요.");
      setState("pin_input");
    }
  };

  // Continue without extension (open tabs directly)
  const handleContinueWithoutExtension = () => {
    setState("pin_input");
  };

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        );

      case "no_id":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle className="h-16 w-16 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">잘못된 링크</h2>
            <p className="text-muted-foreground">
              공유 링크가 올바르지 않습니다. QR 코드를 다시 스캔해주세요.
            </p>
          </div>
        );

      case "checking_extension":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">확장프로그램 확인 중...</p>
          </div>
        );

      case "extension_not_found":
        return (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="p-4 bg-accent/20 rounded-full">
              <Download className="h-12 w-12 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                확장프로그램 설치 필요
              </h2>
              <p className="text-muted-foreground mb-4">
                탭을 복원하려면 Alt-Tab 확장프로그램이 필요합니다.
                <br />
                설치 후 이 페이지를 새로고침해주세요.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => window.open("https://chrome.google.com/webstore/detail/alt-tab", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Chrome 웹 스토어에서 설치
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                설치 후 새로고침
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">또는</span>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleContinueWithoutExtension}
              >
                확장프로그램 없이 계속하기
              </Button>
            </div>
          </div>
        );

      case "pin_input":
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                PIN 코드 입력
              </h2>
              <p className="text-muted-foreground">
                암호화된 탭 그룹을 복원하기 위해
                <br />
                6자리 PIN 코드를 입력해주세요.
              </p>
            </div>

            {pinError && (
              <div className="w-full max-w-md bg-destructive/10 text-destructive py-2 px-4 rounded-md text-sm text-center">
                {pinError}
              </div>
            )}

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={pinValue}
                onChange={(value: string) => setPinValue(value.replace(/[^0-9]/g, ""))}
                onComplete={handleVerifyPin}
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

            <p className="text-xs text-muted-foreground">
              {pinValue.length}/6 자리 입력됨
            </p>

            <Button
              className="w-full max-w-xs bg-primary hover:bg-primary/90"
              onClick={handleVerifyPin}
              disabled={pinValue.length !== 6}
            >
              <Lock className="h-4 w-4 mr-2" />
              탭 복원하기
            </Button>

            <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full max-w-xs">
                  <Share2 className="h-4 w-4 mr-2" />
                  공유하기
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>탭 그룹 공유</DialogTitle>
                  <DialogDescription>
                    QR 코드를 스캔하거나 링크를 복사하여 다른 기기에서 탭을 복원하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="p-4 bg-white rounded-lg shadow-inner">
                    <QRCodeSVG
                      value={shareUrl}
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted truncate"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyUrl}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    이 링크로 접속하면 PIN 코드 입력 후 탭을 복원할 수 있습니다.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            {tabGroupData && (
              <div className="mt-4 p-4 bg-muted rounded-lg w-full max-w-md">
                <p className="text-sm font-medium text-foreground mb-2">
                  복원될 탭: {tabGroupData.browserTabInfos.length}개
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {tabGroupData.browserTabInfos.slice(0, 5).map((tab, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      {tab.faviconUrl && (
                        <img src={tab.faviconUrl} alt="" className="w-4 h-4" />
                      )}
                      <span className="truncate">{tab.title}</span>
                    </div>
                  ))}
                  {tabGroupData.browserTabInfos.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      ... 외 {tabGroupData.browserTabInfos.length - 5}개
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "verifying":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">PIN 코드 확인 중...</p>
          </div>
        );

      case "restoring":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">탭 복원 중...</p>
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">복원 완료!</h2>
            <p className="text-muted-foreground">
              {restoredCount}개의 탭이 성공적으로 복원되었습니다.
            </p>
            <Button
              variant="outline"
              onClick={() => window.close()}
            >
              창 닫기
            </Button>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle className="h-16 w-16 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">오류 발생</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Alt-Tab</h1>
          <p className="text-sm text-muted-foreground">탭 공유 및 복원</p>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
