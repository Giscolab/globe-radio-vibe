# IA — Limites et responsabilités

L’IA (`src/engine/radio/ai/aiEngine.ts`) est **read-only** : elle n’a aucun effet de bord.

## Frontières
- **AI Engine** : calcule contexte, signaux et recommandations de façon déterministe.
- **UI/Stores** : déclenchent les actions (lecture, favoris), jamais l’IA.
- **Audio Engine** : exécute la lecture, l’IA ne pilote pas l’audio.

## Contexte & signaux
- `aiEngine.getContext()` : snapshot (pays, heure, device, query, mode, intent).
- `aiEngine.getUserSignals()` : historique, favoris, signaux (play/skip/error) issus de SQLite.

## Recommandations
- Scoring pondéré (health, préférences, contexte, recency, diversité).
- Résultats expliqués (`summary` + `signals`), déterministes et testables.
- Cache interne avec invalidation lors des changements de favoris/historique/signaux.
