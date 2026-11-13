# FitnessApp

A **Progressive Web App** for logging gym workouts: sets, reps and weights. It tracks personal records and celebrates milestones as you hit them.

Everything is entered by hand for now (no live/wearable tracking). The app is **offline-first**: your data is stored on your device, so it works in a gym with no signal.

## Planned features
- Fast set logging that pre-fills last session's numbers, plus an automatic rest timer
- Live PR detection (estimated 1RM, heaviest weight, rep PRs, best set volume) with celebrations
- Milestones and achievements (workout counts, lifetime volume, plate clubs, weekly-goal streaks)
- Progress charts, calendar heatmap, body measurements
- Installable on iPhone and Android; works offline

See [docs/research/fitness-tracking-research.md](docs/research/fitness-tracking-research.md) for the research behind these choices and the roadmap.

## Planned tech stack
- [Vite](https://vite.dev/) + React + TypeScript
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker + manifest)
- [Dexie](https://dexie.org/) (IndexedDB) for on-device storage
- Hosted on **GitHub Pages** via GitHub Actions

## Development
Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev
```

## Deployment
Every push to `main` builds the app and deploys it to GitHub Pages (`.github/workflows/deploy-pages.yml`).
The site is served from `/FitnessApp/`, so the Vite `base` must read the `BASE_PATH` environment variable that the workflow sets.

## Git account note
This repo uses the personal **DamianDuPreez** GitHub account. The identity is set in the repo-local git config, not the global one.
