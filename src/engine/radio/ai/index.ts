// ============================================================================
// AI Module - Public Exports
// ============================================================================
// Architecture:
// - aiEngine: Client-side scoring & recommendation engine (sync, deterministic)
// - searchAI: Client-side descriptor search helpers (async API, local data only)
// ============================================================================

// AI Engine (client-side recommendation & scoring)
export {
  aiEngine,
  type AIEngine,
  type AIExplanation,
  type AIRecommendationResult,
  type ContextSnapshot,
  type RecommendOptions,
  type UserIntent,
  type UserSignals,
} from './aiEngine';

// Search AI (client-side semantic search)
export {
  searchByText,
  searchSimilarStations,
  getRecommendations,
  searchByAmbience,
  syncEmbeddings,
  type AmbienceType,
} from './searchAI';
