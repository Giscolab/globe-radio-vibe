import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { getEngineConfig } from '@/engine/core/engineConfig';
import { initDatabase } from '@/engine/storage/sqlite/db';
import { initSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import { logger, type LogLevel } from '@/engine/core/logger';
import { usePlaybackSignals } from '@/hooks/usePlaybackSignals';

const Index = lazy(() => import('./pages/Index'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await initDatabase();

        void initSqliteRepository().catch((repoError) => {
          logger.warn('Storage', 'Repository hydration failed', repoError);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize local database');
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}

      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm">
          <div className="max-w-xl rounded-2xl border border-border/60 bg-card p-6 shadow-lg">
            <h1 className="text-lg font-semibold text-foreground">SQLite OPFS initialization failed</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Verify the app is served with `Cross-Origin-Opener-Policy: same-origin` and
              `Cross-Origin-Embedder-Policy: require-corp`.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsInitializer() {
  useEffect(() => {
    const normalizeLevel = (value?: string): LogLevel | 'none' | null => {
      if (!value) return null;
      const normalized = value.toLowerCase();
      if (normalized === 'none') return 'none';
      if (normalized === 'debug') return 'debug';
      if (normalized === 'info') return 'info';
      if (normalized === 'warn') return 'warn';
      if (normalized === 'error') return 'error';
      return null;
    };

    const configLevel = normalizeLevel(getEngineConfig().debug.logLevel);
    const envLevel = normalizeLevel(import.meta.env.VITE_LOG_LEVEL);
    const level = envLevel ?? configLevel ?? 'warn';

    if (level === 'none') {
      logger.setEnabled(false);
      return;
    }

    logger.setEnabled(true);
    logger.setLevel(level);
  }, []);

  return null;
}

function PlaybackSignalsInitializer() {
  usePlaybackSignals();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DatabaseInitializer>
        <SettingsInitializer />
        <PlaybackSignalsInitializer />
        <Toaster />
        <Sonner />

        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DatabaseInitializer>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
