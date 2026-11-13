# FitnessApp

A **Progressive Web App** for logging gym workouts: sets, reps and weights. It tracks personal records and celebrates milestones as you hit them.

> For family use for now. It's deployed to Firebase Hosting but hidden from search engines (`noindex` meta, `X-Robots-Tag` header and `robots.txt`). No accounts: each person's data stays on their own phone.

## What's in v0.1
- **Fast logging:** each set pre-fills from last session (or from the set above). Tap ✓ to confirm, and the rest timer starts automatically.
- **Set types:** tap the set number to cycle Normal → Warm-up (W) → Drop (D) → Failure (F). Warm-ups never count toward PRs.
- **Live PRs:** estimated 1RM (Epley), heaviest weight, rep PRs and best set volume. Hitting one shows a toast, confetti and medals on the set. Your first session with an exercise is the baseline.
- **Workout summary** with stats, PRs and newly unlocked achievements.
- **Achievements** that level up Bronze → Legend: Dedication, Heavy Hauler (lifetime volume), Plate Club, Consistency (weekly-goal streak), Explorer and Big Session.
- **Weekly goal + streak:** counted in weeks, so rest days never break it.
- **Exercise library:** 750+ exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), plus custom exercises.
- **Per-exercise stats:** records, an estimated-1RM chart, history and a plate calculator.
- **kg / lb**, JSON backup export/import, installable, and works offline.

See [docs/research/fitness-tracking-research.md](docs/research/fitness-tracking-research.md) for the research behind these choices and the roadmap.

## Tech stack
- [Vite](https://vite.dev/) + React + TypeScript
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker + manifest)
- [Dexie](https://dexie.org/) (IndexedDB) for on-device storage
- [canvas-confetti](https://github.com/catdad/canvas-confetti) for celebrations
- Vitest + fake-indexeddb for tests
- Hosted on **Firebase Hosting**, deployed by GitHub Actions

## Development
Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + database flow tests
npm run lint
npm run build
```

### Project layout
```
src/
  db/        Dexie schema, types, workout operations (+ tests)
  lib/       pure logic: PR detection, achievements, streaks, units, backup
  components/ shared UI (exercise card, rest timer, toasts, sheets)
  pages/     screens (home, workout, summary, history, exercises, awards, settings)
  data/      generated exercise library
scripts/build-exercises.mjs   regenerates src/data/exercises.json from free-exercise-db
```

To refresh the exercise library, download `dist/exercises.json` from free-exercise-db and run:
```bash
npm run exercises -- path/to/exercises.json
```

## Deployment (Firebase Hosting)
The config is in `firebase.json` and `.firebaserc`. It has SPA rewrites, no-cache for `sw.js`/`index.html` so updates arrive, and long-term caching for hashed assets.

**One-time setup:**
1. Create a project in the [Firebase console](https://console.firebase.google.com/). The free Spark plan is enough.
2. Put the project ID in `.firebaserc` in place of `REPLACE-WITH-FIREBASE-PROJECT-ID`.
3. Log in and connect GitHub. This creates the `FIREBASE_SERVICE_ACCOUNT` repo secret:
   ```bash
   npx firebase-tools login
   npx firebase-tools init hosting:github
   ```
   When asked, keep the existing `firebase.json` (public dir `dist`, single-page app: yes). Don't let it overwrite the workflow files, because `.github/workflows/deploy-firebase.yml` already exists. If the secret it creates has a different name, rename it to `FIREBASE_SERVICE_ACCOUNT`.

**After that:**
- Pushing to `main` deploys the live site (`https://<project-id>.web.app`).
- Pull requests get a temporary preview URL for 7 days.
- Manual deploy from your machine: `npm run deploy`.

Until the secret and project ID are set, the deploy workflow skips itself instead of failing.

## Git account note
This repo uses the personal **DamianDuPreez** GitHub account. The identity is set in the repo-local git config, not the global one.
