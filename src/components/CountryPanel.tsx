import { useGeoStore } from '@/stores/geo.store';
import { Radio, MapPin, X } from 'lucide-react';

export function CountryPanel() {
  const { selectedCountry, setSelectedCountry, isLoading } = useGeoStore();

  if (isLoading) {
    return (
      <div className="neo-raised p-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedCountry) {
    return (
      <div className="neo-raised p-6 text-center">
        <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-lg font-medium text-foreground">Cliquez sur un pays</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Sélectionnez un pays sur le globe pour découvrir ses stations radio
        </p>
      </div>
    );
  }

  return (
    <div className="neo-raised p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{selectedCountry.name}</h2>
          {selectedCountry.continent && (
            <p className="text-sm text-muted-foreground">{selectedCountry.continent}</p>
          )}
        </div>
        <button
          onClick={() => setSelectedCountry(null)}
          className="neo-button p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="neo-pressed p-4 rounded-lg">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Radio className="w-5 h-5" />
          <span className="text-sm">Chargement des stations...</span>
        </div>
      </div>
    </div>
  );
}
