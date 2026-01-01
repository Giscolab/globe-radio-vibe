# Storage — SQLite WASM & persistance

La persistance s’appuie sur SQLite WASM (OPFS si disponible, sinon mémoire).

## Tables clés
- `stations` : cache local des stations.
- `favorites` : favoris utilisateurs.
- `play_history` : historique d’écoute (timestamps DB-first).
- `ai_signals` : signaux IA (play, skip, favorite_add/remove, error).
- `settings` : préférences app.

## Invariants
- **DB-first** pour les données persistantes : ne pas reconstruire de timestamps “fake”.
- Les stores ne sont qu’un miroir pour l’UI ; la source de vérité reste la DB.
