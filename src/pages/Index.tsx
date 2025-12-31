import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlobeCanvas } from '@/components/GlobeCanvas';
import { StationsPanel } from '@/components/StationsPanel';
import { PlayerBar } from '@/components/PlayerBar';
import { useGeoStore } from '@/stores/geo.store';

const queryClient = new QueryClient();

function IndexContent() {
  const { selectedCountry } = useGeoStore();

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Globe */}
        <div className={`flex-1 relative transition-all duration-300 ${selectedCountry ? 'lg:w-2/3' : 'w-full'}`}>
          <GlobeCanvas />
        </div>

        {/* Stations panel */}
        {selectedCountry && (
          <div className="w-full lg:w-1/3 max-w-md border-l border-border/50">
            <StationsPanel />
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
