# FitnessApp

A **Progressive Web App** for logging gym workouts: sets, reps and weights. It tracks personal records and celebrates milestones as you hit them.

> For family use for now. It's deployed to Firebase Hosting but hidden from search engines (`noindex` meta, `X-Robots-Tag` header and `robots.txt`). Each family member signs in (Google or email) so their data is backed up and follows them to a new phone.

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
- Hosted on **Firebase Hosting** (`npm run deploy`)

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

## Accounts and cloud sync
- **Sign-in:** Firebase Authentication (Google or email/password). People can also continue without an account; their data then stays on that phone only.
- **Offline first:** the phone's IndexedDB (Dexie) is the source of truth. Every local change is stamped and flagged by database hooks (`src/sync/localHooks.ts`), deletions are queued as tombstones, and `src/sync/sync.ts` uploads them to Firestore and downloads changes from the person's other devices. Conflicts: the most recent edit wins.
- **Data layout:** `users/{uid}/{workouts|sets|exercises|achievements|settings}/{id}`. `firestore.rules` only lets each person read and write their own documents.
- **Signing out** removes the data from that phone (it stays in the account). A different person signing in on the same phone starts with a clean slate.

## Deployment (Firebase Hosting)
The live site is https://fitnessapp-b7602.web.app. The config is in `firebase.json` and `.firebaserc`. It has SPA rewrites, no-cache for `sw.js`/`index.html` so updates arrive, and long-term caching for hashed assets.

To deploy, run this from your machine. It builds the site and publishes it along with the Firestore security rules:
```bash
npm run deploy
```
The first time, log in with `npx firebase-tools login`, using the personal Google account that owns the Firebase project.

Optional: `.github/workflows/deploy-firebase.yml` can deploy automatically on every push to `main`. It only does this once a `FIREBASE_SERVICE_ACCOUNT` repo secret exists, and skips itself until then.

## Git account note
This repo uses the personal **DamianDuPreez** GitHub account. The identity is set in the repo-local git config, not the global one.
