// ============================================================================
// AI Module - Public Exports
// ============================================================================
// Architecture:
// - aiEngine: Client-side scoring & recommendation engine (sync, deterministic)
// - searchAI: Server-side semantic search via Supabase edge functions (async)
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

// Search AI (server-side semantic search)
export {
  searchByText,
  searchSimilarStations,
  getRecommendations,
  searchByAmbience,
  syncEmbeddings,
  type AmbienceType,
} from './searchAI';
