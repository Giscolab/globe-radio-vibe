# Contribuer

Merci d’envisager une contribution ! Voici les règles principales.

## Pré-requis
- Node.js 20+
- npm

## Installation
```bash
npm install
cp .env.example .env
```

## Scripts utiles
```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

## Bonnes pratiques
- PRs petites et ciblées.
- Pas de renommage/déplacement massif sans justification.
- Respecter les invariants audio/IA (voir `docs/architecture/`).

## Checklist avant PR
- Typecheck / lint / build passent.
- Mise à jour de la doc si nécessaire.
