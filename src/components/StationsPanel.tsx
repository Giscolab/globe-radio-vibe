// Component - StationsPanel: side panel with tabs for stations, favorites, history
import { useState, useEffect } from 'react';
import { X, Radio, RefreshCw, Heart, History, Sparkles, Globe, PanelRightClose } from 'lucide-react';
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
import { healthMonitor } from '@/engine/radio/health';
import { getTopStations } from '@/engine/radio/stationService';

type TabId = 'stations' | 'favorites' | 'history';

const TABS: { id: TabId; label: string; icon: typeof Radio }[] = [
  { id: 'stations', label: 'Stations', icon: Radio },
  { id: 'favorites', label: 'Favoris', icon: Heart },
  { id: 'history', label: 'Historique', icon: History },
];

interface StationsPanelProps {
  onClose?: () => void;
}

export function StationsPanel({ onClose }: StationsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('stations');
  const [selectedAmbience, setSelectedAmbience] = useState<AmbienceType | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const [topStations, setTopStations] = useState<any[]>([]);
  const [isLoadingTop, setIsLoadingTop] = useState(false);
  
  const { selectedCountry, setSelectedCountry } = useGeoStore();
  const { 
    stations: storeStations, 
    setAISearchResults, 
    aiSearchResults, 
    isAISearching, 
    setIsAISearching,
    setStationHealth
  } = useRadioStore();
  const { stations, isLoading, isFetching, refetch } = useStations(selectedCountry?.iso2 ?? null);

  // Load top stations when no country is selected
  useEffect(() => {
    if (!selectedCountry && topStations.length === 0 && !isLoadingTop) {
      setIsLoadingTop(true);
      getTopStations(50)
        .then(setTopStations)
        .catch(console.error)
        .finally(() => setIsLoadingTop(false));
    }
  }, [selectedCountry, topStations.length, isLoadingTop]);

  // Start health monitor and subscribe to updates
  useEffect(() => {
    healthMonitor.start(120000); // Check every 2 minutes
    
    const unsubscribe = healthMonitor.onUpdate((stationId, health) => {
      setStationHealth(stationId, health);
    });
    
    return () => {
      unsubscribe();
    };
  }, [setStationHealth]);

  // Register stations for health monitoring
  useEffect(() => {
    const stationsToMonitor = selectedCountry ? stations : topStations;
    if (stationsToMonitor.length > 0) {
      stationsToMonitor.forEach(station => {
        const url = station.urlResolved || station.url;
        if (url) {
          healthMonitor.registerStation(station.id, url);
        }
      });
    }
  }, [stations, topStations, selectedCountry]);

  // Sync embeddings when stations are loaded
  useEffect(() => {
    const stationsToSync = selectedCountry ? stations : topStations;
    if (stationsToSync.length > 0 && !hasSynced) {
      const enriched = stationsToSync.map(s => enrichStationSync(s));
      syncEmbeddings(enriched).then(() => {
        setHasSynced(true);
        console.log('[StationsPanel] Embeddings synced');
      });
    }
  }, [stations.length, topStations.length, hasSynced, selectedCountry]);

  // Handle ambience selection
  const handleAmbienceSelect = async (ambience: AmbienceType) => {
    const stationsToSearch = selectedCountry ? stations : topStations;
    
    if (selectedAmbience === ambience) {
      // Deselect
      setSelectedAmbience(null);
      setAISearchResults([]);
      return;
    }
    
    setSelectedAmbience(ambience);
    setIsAISearching(true);
    
    try {
      const results = await searchByAmbience(ambience, stationsToSearch);
      setAISearchResults(results);
    } catch (error) {
      console.error('Ambience search failed:', error);
      setAISearchResults([]);
    } finally {
      setIsAISearching(false);
    }
  };

  // Determine which stations to display
  const currentStations = selectedCountry ? stations : topStations;
  const displayedStations = aiSearchResults.length > 0 ? aiSearchResults : currentStations;
  const currentLoading = selectedCountry ? isLoading : isLoadingTop;

  return (
    <div className="neo-raised-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="neo-circle w-10 h-10 flex items-center justify-center">
              {selectedCountry ? (
                <Radio className="w-5 h-5 text-primary" />
              ) : (
                <Globe className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {selectedCountry ? selectedCountry.name : 'Radios populaires'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentLoading ? 'Chargement...' : `${displayedStations.length} stations`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCountry && (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="neo-button p-2"
                title="Actualiser"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            )}
            {selectedCountry && (
              <button
                onClick={() => setSelectedCountry(null)}
                className="neo-button p-2"
                title="Voir toutes les radios"
              >
                <Globe className="w-4 h-4" />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="neo-button p-2"
                title="Fermer le panneau"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
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
      {activeTab === 'stations' && !currentLoading && !selectedAmbience && (
        <div className="border-b border-border/50">
          <RecommendationsPanel />
        </div>
      )}

      {/* Helper text when no country selected */}
      {activeTab === 'stations' && !selectedCountry && !currentLoading && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            💡 Cliquez sur un pays sur le globe pour voir ses radios locales
          </p>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'stations' && (
          <StationList 
            stations={displayedStations} 
            isLoading={currentLoading || isAISearching} 
          />
        )}
        {activeTab === 'favorites' && <FavoritesPanel />}
        {activeTab === 'history' && <HistoryPanel />}
      </div>
    </div>
  );
}
