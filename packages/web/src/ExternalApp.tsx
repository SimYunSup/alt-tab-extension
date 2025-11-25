import { useState, useEffect } from "react";
import {
  Download,
  Loader2,
  RefreshCw,
  Clock,
  Share2,
  Shield,
  Zap,
} from "lucide-react";

// Extension IDs for external messaging
const CHROME_EXTENSION_ID = import.meta.env.VITE_CHROME_EXTENSION_ID;
const FIREFOX_EXTENSION_ID = import.meta.env.VITE_FIREFOX_EXTENSION_ID;

// Declare browser APIs for external messaging
declare const chrome: {
  runtime?: {
    sendMessage?: (extensionId: string, message: unknown) => Promise<{ success?: boolean; url?: string }>;
  };
} | undefined;

declare const browser: {
  runtime?: {
    sendMessage?: (extensionId: string, message: unknown) => Promise<{ success?: boolean; url?: string }>;
  };
} | undefined;

// Detect browser type
function isFirefox(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox");
}

type AppState = "checking" | "no_extension" | "redirecting";

function ExternalApp() {
  const [state, setState] = useState<AppState>("checking");

  useEffect(() => {
    checkExtensionAndRedirect();
  }, []);

  const checkExtensionAndRedirect = async () => {
    const extensionId = isFirefox() ? FIREFOX_EXTENSION_ID : CHROME_EXTENSION_ID;

    // Try to communicate with extension via external messaging
    // Chrome uses chrome.runtime, Firefox uses browser.runtime
    const runtime = isFirefox()
      ? (typeof browser !== "undefined" ? browser?.runtime : undefined)
      : (typeof chrome !== "undefined" ? chrome?.runtime : undefined);

    if (runtime?.sendMessage && extensionId) {
      try {
        console.log("[ExternalApp] Trying external messaging with extension ID:", extensionId);
        const response = await runtime.sendMessage(extensionId, {
          type: "get_redirect_url",
          search: window.location.search, // Pass query params (e.g., ?id=xxx)
        });

        if (response?.success && response?.url) {
          setState("redirecting");
          // Redirect current tab to extension's internal page
          window.location.href = response.url;
          return;
        }
      } catch (error) {
        console.log("[ExternalApp] Extension not found via external messaging:", error);
      }
    }

    // Fallback: Try content script communication
    let redirected = false;
    let pongReceived = false;

    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source !== "alt-tab-extension") return;

      console.log("[ExternalApp] Received message:", event.data.type, event.data);

      if (event.data.type === "pong" && !pongReceived) {
        pongReceived = true;
        // Request extension URL for redirect
        console.log("[ExternalApp] Sending get_redirect_url with search:", window.location.search);
        window.postMessage({
          source: "alt-tab-web",
          type: "get_redirect_url",
          search: window.location.search,
        }, "*");
      }

      if (event.data.type === "redirect_url_response" && event.data.data?.url) {
        redirected = true;
        window.removeEventListener("message", messageHandler);
        console.log("[ExternalApp] Redirecting to:", event.data.data.url);
        setState("redirecting");
        // Redirect current tab
        window.location.href = event.data.data.url;
      }
    };

    window.addEventListener("message", messageHandler);

    // Ping extension
    console.log("[ExternalApp] Sending ping...");
    window.postMessage({ source: "alt-tab-web", type: "ping" }, "*");

    // Timeout - show install UI if no response
    setTimeout(() => {
      if (!redirected) {
        console.log("[ExternalApp] Timeout - no redirect happened, pongReceived:", pongReceived);
        window.removeEventListener("message", messageHandler);
        setState("no_extension");
      }
    }, 2000);
  };

  if (state === "checking" || state === "redirecting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Alt-Tab</h1>
            <p className="text-sm text-muted-foreground">탭 공유 및 복원</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {state === "checking" ? "확장프로그램 확인 중..." : "확장프로그램으로 이동 중..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // no_extension state - Landing page
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Alt-Tab</h1>
          <p className="text-sm text-muted-foreground">탭 공유 및 복원</p>
        </div>

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
            <button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
              onClick={() => window.open("https://chrome.google.com/webstore/detail/alt-tab", "_blank")}
            >
              <Download className="h-4 w-4" />
              Chrome에서 설치하기
            </button>
            <button
              className="w-full border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium py-2.5 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
              onClick={() => window.open("https://addons.mozilla.org/firefox/addon/alt-tab", "_blank")}
            >
              <Download className="h-4 w-4" />
              Firefox에서 설치하기
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center">
              탭 공유 링크를 받으셨나요? 확장프로그램 설치 후 다시 방문해주세요.
            </p>
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3" />
              설치 후 새로고침
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExternalApp;
