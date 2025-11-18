import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { verifyPinCode } from "@/lib/crypto";
import {
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

interface TabGroupData {
  id: string;
  secret: string;
  salt: string;
  browserTabInfos: Array<{
    url: string;
    title: string;
    faviconUrl?: string;
  }>;
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

  // Parse URL to get tab group ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

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

    // Listen for response from extension content script
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source !== "alt-tab-extension") return;

      if (event.data.type === "pong" && event.data.data?.success) {
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
      if (state === "checking_extension") {
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

      // PIN is correct, restore tabs
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

        // Send restore request to extension via postMessage
        window.postMessage(
          {
            source: "alt-tab-web",
            type: "restore_tabs",
            data: {
              tabs: tabGroupData.browserTabInfos,
            },
          },
          "*"
        );

        // Timeout fallback
        setTimeout(() => {
          if (state === "restoring") {
            setErrorMessage("탭 복원 시간이 초과되었습니다.");
            setState("error");
            window.removeEventListener("message", restoreHandler);
          }
        }, 10000);
      } else {
        // No extension, open tabs directly in browser
        setState("restoring");
        let count = 0;
        for (const tab of tabGroupData.browserTabInfos) {
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
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="text-slate-600">로딩 중...</p>
          </div>
        );

      case "no_id":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle className="h-16 w-16 text-red-500" />
            <h2 className="text-xl font-semibold text-slate-900">잘못된 링크</h2>
            <p className="text-slate-600">
              공유 링크가 올바르지 않습니다. QR 코드를 다시 스캔해주세요.
            </p>
          </div>
        );

      case "checking_extension":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="text-slate-600">확장프로그램 확인 중...</p>
          </div>
        );

      case "extension_not_found":
        return (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="p-4 bg-amber-50 rounded-full">
              <Download className="h-12 w-12 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                확장프로그램 설치 필요
              </h2>
              <p className="text-slate-600 mb-4">
                탭을 복원하려면 Alt-Tab 확장프로그램이 필요합니다.
                <br />
                설치 후 이 페이지를 새로고침해주세요.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
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
                  <span className="bg-white px-2 text-slate-500">또는</span>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full text-slate-600"
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
            <div className="p-4 bg-blue-50 rounded-full">
              <Lock className="h-10 w-10 text-blue-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                PIN 코드 입력
              </h2>
              <p className="text-slate-600">
                암호화된 탭 그룹을 복원하기 위해
                <br />
                6자리 PIN 코드를 입력해주세요.
              </p>
            </div>

            {pinError && (
              <div className="w-full max-w-md bg-red-50 text-red-600 py-2 px-4 rounded-md text-sm text-center">
                {pinError}
              </div>
            )}

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={pinValue}
                onChange={(value) => setPinValue(value.replace(/[^0-9]/g, ""))}
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

            <p className="text-xs text-slate-500">
              {pinValue.length}/6 자리 입력됨
            </p>

            <Button
              className="w-full max-w-xs bg-blue-600 hover:bg-blue-700"
              onClick={handleVerifyPin}
              disabled={pinValue.length !== 6}
            >
              <Lock className="h-4 w-4 mr-2" />
              탭 복원하기
            </Button>

            {tabGroupData && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg w-full max-w-md">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  복원될 탭: {tabGroupData.browserTabInfos.length}개
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {tabGroupData.browserTabInfos.slice(0, 5).map((tab, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      {tab.faviconUrl && (
                        <img src={tab.faviconUrl} alt="" className="w-4 h-4" />
                      )}
                      <span className="truncate">{tab.title}</span>
                    </div>
                  ))}
                  {tabGroupData.browserTabInfos.length > 5 && (
                    <p className="text-xs text-slate-500">
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
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="text-slate-600">PIN 코드 확인 중...</p>
          </div>
        );

      case "restoring":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="text-slate-600">탭 복원 중...</p>
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-green-50 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">복원 완료!</h2>
            <p className="text-slate-600">
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
            <XCircle className="h-16 w-16 text-red-500" />
            <h2 className="text-xl font-semibold text-slate-900">오류 발생</h2>
            <p className="text-slate-600">{errorMessage}</p>
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Alt-Tab</h1>
          <p className="text-sm text-slate-500">탭 공유 및 복원</p>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
