# Audio Engine Invariants

Le moteur audio (`src/engine/player/audioEngine.ts`) est la source de vérité de la lecture.  
Les stores et l’UI ne simulent jamais l’état audio (ils reflètent uniquement les callbacks réels).

## Responsabilités
- **audioEngine** : pilote la lecture (play/pause/stop), la transition de flux et les erreurs.
- **UI/stores** : observent l’état et déclenchent des actions, sans forcer un état cosmétique.
- **fallbacks** : si un flux proxy est actif, le passage au direct se fait sans interrompre la lecture.

## Invariants concrets
1. Une seule transition à la fois (play/stop/switch), les appels sont sérialisés.
2. Le changement proxy → direct est tenté uniquement si la lecture est stable, avec repli immédiat.
3. Aucun `setIsPlaying` “cosmétique” côté UI : le statut provient toujours de `audioEngine`.
4. Les erreurs sont visibles et actionnables, avec possibilité de relancer la lecture.
