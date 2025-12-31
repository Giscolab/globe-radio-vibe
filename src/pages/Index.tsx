import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlobeCanvas } from '@/components/GlobeCanvas';
import { StationsPanel } from '@/components/StationsPanel';
import { PlayerBar } from '@/components/PlayerBar';
import { GenreLegend } from '@/components/GenreLegend';
import { useState } from 'react';
import { PanelRightClose, PanelRight } from 'lucide-react';

const queryClient = new QueryClient();

function IndexContent() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Globe */}
        <div className={`flex-1 relative transition-all duration-300`}>
          <GlobeCanvas />
          
          {/* Genre legend */}
          <GenreLegend />
          
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
            <StationsPanel onClose={() => setIsPanelOpen(false)} />
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
