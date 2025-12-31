// Component - StationsPanel: side panel for country stations
import { X, Radio, RefreshCw } from 'lucide-react';
import { useGeoStore } from '@/stores/geo.store';
import { useStations } from '@/hooks/useStations';
import { StationList } from './StationList';

export function StationsPanel() {
  const { selectedCountry, setSelectedCountry } = useGeoStore();
  const { stations, isLoading, isFetching, refetch } = useStations(selectedCountry?.iso2 ?? null);

  if (!selectedCountry) {
    return null;
  }

  return (
    <div className="neo-raised-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="neo-circle w-10 h-10 flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{selectedCountry.name}</h3>
              <p className="text-sm text-muted-foreground">
                {isLoading ? 'Chargement...' : `${stations.length} stations`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="neo-button p-2"
              title="Actualiser"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setSelectedCountry(null)}
              className="neo-button p-2"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Station list */}
      <div className="flex-1 overflow-hidden">
        <StationList stations={stations} isLoading={isLoading} />
      </div>
    </div>
  );
}
