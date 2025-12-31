import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayerBar } from '@/components/PlayerBar';
import { useState, lazy, Suspense } from 'react';
import { PanelRight, Loader2 } from 'lucide-react';

// Lazy load heavy components to reduce initial bundle
const GlobeCanvas = lazy(() => import('@/components/GlobeCanvas').then(m => ({ default: m.GlobeCanvas })));
const StationsPanel = lazy(() => import('@/components/StationsPanel').then(m => ({ default: m.StationsPanel })));
const GenreLegend = lazy(() => import('@/components/GenreLegend').then(m => ({ default: m.GenreLegend })));

const queryClient = new QueryClient();

function LoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function IndexContent() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Globe */}
        <div className={`flex-1 relative transition-all duration-300`}>
          <Suspense fallback={<LoadingFallback />}>
            <GlobeCanvas />
          </Suspense>
          
          {/* Genre legend */}
          <Suspense fallback={null}>
            <GenreLegend />
          </Suspense>
          
          {/* Toggle button when panel is closed */}
          {!isPanelOpen && (
            <button
              onClick={() => setIsPanelOpen(true)}
              className="absolute top-4 right-4 neo-button p-3 z-10"
              title="Ouvrir le panneau"
            >
              <PanelRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Stations panel - always visible */}
        {isPanelOpen && (
          <div className="w-full lg:w-[400px] max-w-md border-l border-border/50 flex flex-col">
            <Suspense fallback={<LoadingFallback />}>
              <StationsPanel onClose={() => setIsPanelOpen(false)} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Player bar */}
      <div className="border-t border-border/50">
        <PlayerBar />
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <QueryClientProvider client={queryClient}>
      <IndexContent />
    </QueryClientProvider>
  );
}
