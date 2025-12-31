// Component - StationsPanel: side panel with tabs for stations, favorites, history
import { useState, useEffect } from 'react';
import { X, Radio, RefreshCw, Heart, History, Sparkles } from 'lucide-react';
import { useGeoStore } from '@/stores/geo.store';
import { useRadioStore } from '@/stores/radio.store';
import { useStations } from '@/hooks/useStations';
import { StationList } from './StationList';
import { FavoritesPanel } from './FavoritesPanel';
import { HistoryPanel } from './HistoryPanel';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { AmbienceChips } from './AmbienceChips';
import { RecommendationsPanel } from './RecommendationsPanel';
import { searchByAmbience, syncEmbeddings, type AmbienceType } from '@/engine/radio/ai/searchAI';
import { enrichStationSync } from '@/engine/radio/enrichment/stationEnricher';

type TabId = 'stations' | 'favorites' | 'history';

const TABS: { id: TabId; label: string; icon: typeof Radio }[] = [
  { id: 'stations', label: 'Stations', icon: Radio },
  { id: 'favorites', label: 'Favoris', icon: Heart },
  { id: 'history', label: 'Historique', icon: History },
];

export function StationsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('stations');
  const [selectedAmbience, setSelectedAmbience] = useState<AmbienceType | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  
  const { selectedCountry, setSelectedCountry } = useGeoStore();
  const { 
    stations: storeStations, 
    setAISearchResults, 
    aiSearchResults, 
    isAISearching, 
    setIsAISearching 
  } = useRadioStore();
  const { stations, isLoading, isFetching, refetch } = useStations(selectedCountry?.iso2 ?? null);

  // Sync embeddings when stations are loaded
  useEffect(() => {
    if (stations.length > 0 && !hasSynced) {
      const enriched = stations.map(s => enrichStationSync(s));
      syncEmbeddings(enriched).then(() => {
        setHasSynced(true);
        console.log('[StationsPanel] Embeddings synced');
      });
    }
  }, [stations.length, hasSynced]);

  // Handle ambience selection
  const handleAmbienceSelect = async (ambience: AmbienceType) => {
    if (selectedAmbience === ambience) {
      // Deselect
      setSelectedAmbience(null);
      setAISearchResults([]);
      return;
    }
    
    setSelectedAmbience(ambience);
    setIsAISearching(true);
    
    try {
      const results = await searchByAmbience(ambience, stations);
      setAISearchResults(results);
    } catch (error) {
      console.error('Ambience search failed:', error);
      setAISearchResults([]);
    } finally {
      setIsAISearching(false);
    }
  };

  if (!selectedCountry) {
    return null;
  }

  // Use AI results if available, otherwise show all stations
  const displayedStations = aiSearchResults.length > 0 ? aiSearchResults : stations;

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
                {isLoading ? 'Chargement...' : `${displayedStations.length} stations`}
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

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                isActive 
                  ? 'text-primary border-b-2 border-primary bg-primary/5' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters (only for stations tab) */}
      {activeTab === 'stations' && (
        <>
          <div className="p-4 space-y-3 border-b border-border/50">
            <SearchBar placeholder="Rechercher une station..." />
            
            {/* Ambience chips */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>Ambiance</span>
              </div>
              <AmbienceChips 
                onSelect={handleAmbienceSelect}
                selected={selectedAmbience}
                disabled={isAISearching}
              />
            </div>
          </div>
          <FilterPanel />
        </>
      )}

      {/* Recommendations (for stations tab) */}
      {activeTab === 'stations' && !isLoading && !selectedAmbience && (
        <div className="border-b border-border/50">
          <RecommendationsPanel />
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'stations' && (
          <StationList 
            stations={displayedStations} 
            isLoading={isLoading || isAISearching} 
          />
        )}
        {activeTab === 'favorites' && <FavoritesPanel />}
        {activeTab === 'history' && <HistoryPanel />}
      </div>
    </div>
  );
}
