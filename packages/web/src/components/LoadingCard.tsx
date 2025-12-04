import { Loader2 } from 'lucide-react';

interface LoadingCardProps {
  title: string;
  subtitle: string;
  message: string;
}

export function LoadingCard({ title, subtitle, message }: LoadingCardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
