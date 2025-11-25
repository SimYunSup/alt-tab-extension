import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Clock,
  Share2,
  Shield,
  Zap,
} from "lucide-react";

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type AppState =
  | "loading"
  | "no_id"
  | "checking_extension"
  | "extension_not_found"
  | "redirecting"
  | "error";

function ExternalApp() {
  const [state, setState] = useState<AppState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse URL to get tab group ID
  useEffect(() => {
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

    // Verify tab group exists before checking extension
    verifyTabGroup(id);
  }, []);

  // Verify tab group exists on server
  const verifyTabGroup = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tab-group/${id}`, {
        method: 'HEAD', // Just check if it exists
      });

      if (!response.ok) {
        if (response.status === 404) {
          setErrorMessage("탭 그룹을 찾을 수 없거나 만료되었습니다.");
        } else {
          setErrorMessage("서버 오류가 발생했습니다.");
        }
        setState("error");
        return;
      }

      checkExtension(id);
    } catch (error) {
      console.error("Failed to verify tab group:", error);
      setErrorMessage("서버에 연결할 수 없습니다.");
      setState("error");
    }
  };

  // Check if extension is installed and get extension URL
  const checkExtension = (id: string) => {
    setState("checking_extension");
    let responseReceived = false;

    // Listen for response from extension content script
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source !== "alt-tab-extension") return;

      if (event.data.type === "pong" && event.data.data?.success) {
        responseReceived = true;
        window.removeEventListener("message", messageHandler);

        // Request extension URL for redirect
        requestExtensionUrl(id);
      }
    };

    window.addEventListener("message", messageHandler);

    // Send ping to extension via postMessage
    window.postMessage(
      {
        source: "alt-tab-web",
        type: "ping",
      },
      "*"
    );

    // Timeout fallback
    setTimeout(() => {
      if (!responseReceived) {
        setState("extension_not_found");
        window.removeEventListener("message", messageHandler);
      }
    }, 2000);
  };

  // Request extension URL and redirect
  const requestExtensionUrl = (id: string) => {
    setState("redirecting");

    const urlHandler = (event: MessageEvent) => {
      if (event.data?.source !== "alt-tab-extension") return;

      if (event.data.type === "extension_url_response" && event.data.data?.url) {
        window.removeEventListener("message", urlHandler);

        // Redirect to extension's internal web page
        const extensionWebUrl = `${event.data.data.url}web/index.html?id=${id}`;
        console.log("[External] Redirecting to:", extensionWebUrl);
        window.location.href = extensionWebUrl;
      }
    };

    window.addEventListener("message", urlHandler);

    // Request extension base URL
    window.postMessage(
      {
        source: "alt-tab-web",
        type: "get_extension_url",
      },
      "*"
    );

    // Timeout fallback - if no response, show error
    setTimeout(() => {
      window.removeEventListener("message", urlHandler);
      // If we're still on redirecting state, something went wrong
      if (state === "redirecting") {
        setErrorMessage("확장프로그램과 통신할 수 없습니다.");
        setState("error");
      }
    }, 3000);
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
          <div className="flex flex-col items-center gap-8">
            {/* Hero Section */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-4">
                <Zap className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                스마트한 탭 관리의 시작
              </h2>
              <p className="text-muted-foreground max-w-md">
                Alt-Tab은 브라우저 탭을 자동으로 정리하고,
                <br />
                안전하게 다른 기기와 공유할 수 있는 확장프로그램입니다.
              </p>
            </div>

            {/* Features */}
            <div className="grid gap-4 w-full max-w-md">
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">자동 탭 정리</h3>
                  <p className="text-sm text-muted-foreground">
                    오래 사용하지 않은 탭을 자동으로 닫고 기록합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Share2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">QR 코드로 공유</h3>
                  <p className="text-sm text-muted-foreground">
                    탭 그룹을 QR 코드로 다른 기기에 쉽게 공유하세요.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">E2E 암호화</h3>
                  <p className="text-sm text-muted-foreground">
                    PIN 코드로 암호화되어 안전하게 전송됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => window.open("https://chrome.google.com/webstore/detail/alt-tab", "_blank")}
              >
                <Download className="h-4 w-4 mr-2" />
                Chrome에서 설치하기
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open("https://addons.mozilla.org/firefox/addon/alt-tab", "_blank")}
              >
                <Download className="h-4 w-4 mr-2" />
                Firefox에서 설치하기
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              탭 공유 링크를 받으셨나요? 확장프로그램 설치 후 다시 방문해주세요.
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

      case "redirecting":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">확장프로그램으로 이동 중...</p>
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
            </div>
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
      <div className={`w-full bg-card rounded-2xl shadow-xl p-8 ${state === "no_id" ? "max-w-xl" : "max-w-lg"}`}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Alt-Tab</h1>
          <p className="text-sm text-muted-foreground">탭 공유 및 복원</p>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

export default ExternalApp;
