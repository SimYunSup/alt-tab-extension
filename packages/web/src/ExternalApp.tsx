import { Download, RefreshCw, Clock, Share2, Shield, Zap } from 'lucide-react';
import { useExtensionDetection } from './hooks/useExtensionDetection';
import { FeatureCard } from './components/FeatureCard';
import { LoadingCard } from './components/LoadingCard';
import { STORE_URLS, APP_INFO } from './constants';

const FEATURES = [
  {
    icon: Clock,
    title: '자동 탭 정리',
    description: '오래 사용하지 않은 탭을 자동으로 닫고 기록합니다.',
  },
  {
    icon: Share2,
    title: 'QR 코드로 공유',
    description: '탭 그룹을 QR 코드로 다른 기기에 쉽게 공유하세요.',
  },
  {
    icon: Shield,
    title: 'E2E 암호화',
    description: 'PIN 코드로 암호화되어 안전하게 전송됩니다.',
  },
] as const;

function ExternalApp() {
  const { state, retry } = useExtensionDetection();

  // Loading states (checking or redirecting)
  if (state === 'checking' || state === 'redirecting') {
    return (
      <LoadingCard
        title={APP_INFO.name}
        subtitle={APP_INFO.tagline}
        message={state === 'checking' ? '확장프로그램 확인 중...' : '확장프로그램으로 이동 중...'}
      />
    );
  }

  // Extension not found - show landing page
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">{APP_INFO.name}</h1>
          <p className="text-sm text-muted-foreground">{APP_INFO.tagline}</p>
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
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
              onClick={() => window.open(STORE_URLS.chrome, '_blank')}
            >
              <Download className="h-4 w-4" />
              Chrome에서 설치하기
            </button>
            <button
              type="button"
              className="w-full border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium py-2.5 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
              onClick={() => window.open(STORE_URLS.firefox, '_blank')}
            >
              <Download className="h-4 w-4" />
              Firefox에서 설치하기
            </button>
          </div>

          {/* Refresh prompt */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center">
              탭 공유 링크를 받으셨나요? 확장프로그램 설치 후 다시 방문해주세요.
            </p>
            <button
              type="button"
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={retry}
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
