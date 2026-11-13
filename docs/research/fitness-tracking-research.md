# Fitness Tracking Research

_Research date: 13 November 2026. Purpose: decide what FitnessApp (a manual-logging gym tracker PWA) should do, based on how existing apps handle logging, personal records (PRs), milestones and celebrations._

> **Note on sources:** much of what's written about fitness apps comes from the app makers themselves or from competitors' comparison blogs. Treat feature claims as directional. The sources are listed at the end.

---

## 1. TL;DR: what we should build

1. **Logging has to be very fast.** Leading apps aim for under ~10 seconds per set. Pre-fill each set with what you did last time, confirm it with one big tap, and start the rest timer automatically.
2. **PRs are detected live, the moment a set is ticked off**, not after the workout. Show a banner/toast straight away, then a bigger celebration on the workout summary screen.
3. **Track several kinds of PR per exercise**, not just "heaviest weight": estimated 1RM, heaviest weight, best weight at each rep count, best set volume, most reps, plus workout-level records.
4. **Milestones are for long-term motivation:** lifetime volume tiers, workout counts, consistency weeks, "plate clubs" (first 60 kg / 100 kg / 140 kg lift), and optional bodyweight-ratio strength levels.
5. **Streaks should be weekly and forgiving** (e.g. "3 weeks in a row hitting your weekly goal"), not daily. Daily streaks punish rest days, and rest days are part of training. They're also a well-documented cause of anxiety and burnout.
6. **Celebrations should match how big the achievement is:** a small toast for a set PR, confetti for an all-time 1RM PR, a full-screen card for a milestone. Respect `prefers-reduced-motion`, and treat vibration as a bonus on devices that support it.
7. **Offline-first:** keep all data on the device in IndexedDB, with export/import from day one. The phone is the database until we add sync.

---

## 2. Landscape: what the main apps do

| App | Focus | Notable for us |
|---|---|---|
| **Hevy** | Logging + social | Live PR banner when a set is ticked; a medal on the PR set in the saved workout; separates "set records" from true PRs; weekly streak; calendar; body measurements + progress photos; yearly review; per-exercise rest timer; set types (warm-up / failure / drop). |
| **Strong** | Minimalist logbook | Precise PR tracking, CSV export, templates. Often called the cleanest logger. Estimated 1RM is behind a paywall. |
| **Fitbod** | AI-generated workouts | Muscle recovery % (0–100%) + recovery heat map; automatic progressive overload; milestones (workouts done, weight lifted). |
| **Jefit** | Programming depth | Large exercise library, planned deloads, community. |
| **Boostcamp / Liftosaur** | Following structured programs | RPE/RIR on every set; programs with built-in progression rules. |
| **Tonal / Volt / Everfit** | Achievements | Lifetime-volume milestones (10k, 50k, 1M lbs); playful comparisons ("you've lifted an elephant"); tiered badges (silver/gold/diamond). |
| **Strava** | Endurance + social | Monthly challenge badges with distinctive illustrated art; an animated "Year in Sport" recap that people share. |
| **Strength Level** | Strength standards | Beginner → Elite levels per lift, based on millions of user-logged lifts. |

**Common free features across the leaders** (what users expect as a minimum): unlimited workout logging, routines/templates, an exercise library, history, basic PRs, rest timer, CSV export.

**Common paid features** (where we can stand out for free): estimated 1RM charts, advanced stats, full measurement tracking, unlimited history.

---

## 3. Workout logging UX

### The logging loop
```
Start workout (empty, or from a routine)
 └─ Add exercise
     └─ Set row: [type] [previous: 80kg × 8] [kg ___] [reps ___] [✓]
         └─ Tap ✓  → set saved → PR check → rest timer starts
 └─ Finish → summary (duration, volume, PRs 🏅, milestones) → save
```

### Patterns worth copying
- **A "Previous" column:** show last session's weight × reps next to each set. Pre-fill the inputs from it but keep them **visibly unconfirmed** (greyed out) until the user taps ✓.
- **One-tap confirm:** a large ✓ target that's easy to hit with a sweaty thumb.
- **Rest timer starts automatically** when a set is ticked. The default is set per exercise (e.g. 3 min for squats, 90 s for curls), with quick ±15 s buttons. Keep it attached to the workout screen, not as a blocking popup.
- **Don't over-automate:** lifters don't want the next set to start on its own. Every set is confirmed by the user.
- **Set types:** normal, warm-up (W), drop set (D), failure (F). **Warm-ups don't count toward PRs or volume.**
- **Optional RPE/RIR per set** (off by default, can be turned on in settings). RPE 10 = failure, RPE 9 ≈ 1 rep left, RPE 8 ≈ 2 reps left.
- **Supersets:** group two or more exercises so the user alternates between them.
- **Notes** per exercise and per workout ("left shoulder felt tight").
- **Plate calculator:** show which plates go on each side for a target weight. Very handy, and simple to build.
- **Workout keeps running in the background:** if the user leaves the app, the in-progress workout is still there when they come back (it's saved to IndexedDB on every change).

### Exercise library
- Start from **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)**: 800+ exercises, released under the **Unlicense** (public domain), as JSON with `name, level, equipment, primaryMuscles, secondaryMuscles, instructions, category, images`. Check the image licensing before shipping the images.
- Let users create **custom exercises**.
- Each exercise needs a **tracking type**, because not everything is weight × reps:
  - `weight_reps` (bench press)
  - `bodyweight_reps` (pull-ups, optionally with added or assisted weight)
  - `reps_only` (push-ups)
  - `duration` (plank)
  - `distance_duration` (rowing, treadmill)

---

## 4. Personal records (PRs)

### PR types to track per exercise
| Record | Formula | Example message |
|---|---|---|
| **Estimated 1RM** | Epley: `w × (1 + reps/30)`. Only use sets of ≤ 10 reps. | "New est. 1RM: 112.5 kg" |
| **Heaviest weight** | max `w` | "Heaviest bench ever: 100 kg" |
| **Rep PR at weight** | most reps at ≥ this weight | "8 reps at 80 kg, previous best 6" |
| **Weight PR at rep count** | best `w` for exactly N reps (1, 3, 5, 8, 10) | "New 5RM: 90 kg" |
| **Best set volume** | max `w × reps` in one set | "Best set: 720 kg" |
| **Most reps** (bodyweight / reps-only) | max reps | "21 push-ups in a row!" |
| **Longest duration** (timed) | max seconds | "Plank: 2:15" |

**Workout-level records:** highest-volume workout, most sets, longest workout.

### Rules
- Warm-up sets are **excluded**. Drop sets count toward volume but not toward 1RM.
- **Check for a PR the moment a set is ticked**, against that exercise's stored bests (kept in a `personalRecords` table so we don't scan the whole history).
- The **first time** someone does an exercise, don't spam them with 6 "PRs". Treat it as a baseline ("First log: 60 kg × 8. This is your baseline.").
- Several PRs from one set are grouped into a single notification.
- If a set is edited or deleted, recompute that exercise's records.
- Hevy separates **"set records"** (a better set than any earlier one in this workout, shown inline without fanfare) from **true all-time PRs** (banner + medal). We should do the same.

### About 1RM formulas
- **Epley** `w(1 + r/30)` and **Brzycki** `w × 36/(37 − r)` are the standards. Both are reasonably accurate for 1–10 reps and get unreliable above that.
- **Recommendation:** use Epley for display, only compute it for sets of ≤ 10 reps, and label it "estimated". Averaging several formulas is a later improvement if we need it.

---

## 5. Milestones and achievements

How other apps do it: **cumulative tiers** (lifetime volume, workout count), **single-event records**, **consistency**, and **playful comparisons**. Our proposed catalog:

### Consistency
- Workouts logged: 1, 5, 10, 25, 50, 100, 250, 500, 1000
- Weekly goal streak: 2, 4, 8, 12, 26, 52 weeks in a row
- "Comeback": logging a workout after more than 14 days off. This rewards returning instead of punishing the gap.

### Volume
- Lifetime volume tiers: 1 t, 10 t, 50 t, 100 t, 500 t, 1,000 t
- Fun comparisons: "You've lifted a car 🚗 (1.5 t)", "an elephant 🐘 (6 t)", "a blue whale 🐋 (150 t)"
- Best single-workout volume

### Strength
- **Plate clubs:** first lift with 1/2/3/4 plates on each side (60 / 100 / 140 / 180 kg on a 20 kg bar)
- **Big-3 total clubs:** squat + bench + deadlift estimated 1RM total of 300 / 400 / 500 kg (the "1000 lb club" ≈ 453.6 kg)
- **Bodyweight ratios** (needs bodyweight logged): e.g. bench 1× BW, squat 1.5× BW, deadlift 2× BW
- **Strength level per lift** (Beginner → Novice → Intermediate → Advanced → Elite) based on ratio tables. Different sources draw these lines differently, so present them as a guide, not a verdict.

### Exploration
- First time training each muscle group; trying 10 / 25 / 50 different exercises

### Goals the user sets
- "Bench 100 kg by March". Shown as a progress bar using the current estimated 1RM, with a celebration when it's reached.
- Bodyweight / measurement goals (target weight, waist size).

### Tiers and visuals
Use **Bronze → Silver → Gold → Platinum → Diamond** tiers per achievement family, so one badge "levels up" instead of 20 separate badges cluttering the screen. Locked badges show progress ("37 / 50 workouts").

---

## 6. Celebrations: making wins feel good

### Scale the celebration to the achievement
| Event | Treatment |
|---|---|
| Set record (better than earlier sets in this workout) | Subtle: the row glows, a small 🔥 icon |
| All-time PR | Toast/banner slides in + medal icon on the set + short vibration (where supported) |
| Milestone / goal reached | Full-screen card: badge animation, confetti burst, "Share" button |
| Workout finished | Summary screen: stats, list of PRs with medals, milestone progress bars |
| Monthly / yearly recap | Story-style slides (Strava "Year in Sport" style), shareable image |

### Implementation notes
- **[canvas-confetti](https://github.com/catdad/canvas-confetti)** is the go-to library. It's tiny, renders on canvas, and has a `disableForReducedMotion` option.
- **Vibration API** (`navigator.vibrate`) works on Android Chrome but **not on iOS Safari**, so it's only ever a bonus.
- Always respect **`prefers-reduced-motion`**: replace confetti with a simple fade or scale-in.
- **Shareable cards:** render the PR/milestone to a `<canvas>` → PNG → Web Share API (`navigator.share({ files })`). Users love sharing PRs to Instagram or WhatsApp.
- Show the celebration **after** the set is saved, never in a way that blocks logging the next set. The user may be mid-superset.
- Use celebrations sparingly. If everything triggers confetti, it stops meaning anything.

---

## 7. Streaks: proceed with care

What the research found:
- About half of health & fitness apps have a streak screen.
- **Daily streaks cause anxiety, shame and burnout** once they break. Even "streak freezes" are criticised as a band-aid.
- Better alternatives: **weekly streaks** (Hevy counts consecutive weeks with at least one workout), **capped or resetting cycles** (Apple's rings reset daily, so nothing big is ever lost), and **never charging money to save a streak**.

**Our approach:**
- The user sets a **weekly goal** (e.g. 3 workouts/week). The streak is the number of consecutive weeks that goal was met.
- Rest days never break anything.
- Optional "**rest weeks**" (e.g. 1 per 8 weeks) for holidays, illness or deloads. The streak pauses instead of dying.
- After a break, frame it positively: "Welcome back! Your longest streak was 12 weeks. Let's start a new one."

---

## 8. Progress and stats

- **Per-exercise charts:** estimated 1RM over time, best set weight, session volume. Time ranges: 1 month, 3 months, 1 year, all.
- **Calendar heatmap** of workout days (GitHub-contribution style). Show "days since last workout" gently.
- **Weekly volume per muscle group**, as a bar chart or body heat map (Fitbod/Hevy style). Use primary muscle = 1 set, secondary = 0.5 set.
- **Body measurements:** bodyweight, body fat %, circumferences (chest, waist, hips, arms, thighs, calves, neck), each with a trend line.
- **Progress photos:** one per day at most, private, stored on the device; side-by-side compare. Recommend taking them every 4–5 weeks.

---

## 9. PWA technical findings

| Topic | Finding | What we do |
|---|---|---|
| Stack | Several open-source workout PWAs use **Vite + vite-plugin-pwa + Dexie (IndexedDB)** successfully | Use that stack |
| Offline | Service worker precaches the app shell; data lives in IndexedDB | Fully usable in a gym basement with no signal |
| iOS install | Only via Safari → Share → "Add to Home Screen"; no install prompt | Show our own "How to install" hint on iOS |
| iOS storage | Safari can **evict data after ~7 days of non-use** for sites not installed to the Home Screen; installed apps are safer | Encourage installing; call `navigator.storage.persist()`; **export/backup from day one** |
| Push notifications | iOS 16.4+ only for installed apps; not needed for MVP | Skip for now |
| Background sync | Not supported on iOS | Not needed (local-first) |
| Schema changes | Dexie migrations should be additive-only so offline users aren't broken | Version the DB schema carefully |
| Rest timer while screen locked | JS timers pause in the background | Store the timer's **end timestamp** and compute remaining time; optionally use the Screen Wake Lock API during workouts |

**Hosting:** GitHub Pages (free, HTTPS, required for service workers) via GitHub Actions. This is set up in this repo.

---

## 10. Draft data model (Dexie / IndexedDB)

```ts
exercises        { id, name, trackingType, primaryMuscles[], secondaryMuscles[], equipment, isCustom, defaultRestSec }
routines         { id, name, notes, exercises: [{ exerciseId, sets: [{ type, targetReps, targetWeight }] }] }
workouts         { id, name, startedAt, endedAt, notes, routineId? }
workoutSets      { id, workoutId, exerciseId, order, setType, weightKg, reps, durationSec, distanceM, rpe?, completedAt }
personalRecords  { id, exerciseId, recordType, value, setId, achievedAt }
achievements     { id, key, tier, unlockedAt, progress }
bodyMeasurements { id, date, weightKg, bodyFatPct, chest, waist, ... }
progressPhotos   { id, date, blob, pose }
settings         { unit: 'kg'|'lb', weeklyGoal, barWeightKg, availablePlates[], defaultRestSec, rpeEnabled }
```
Store weight in **kg internally** and convert for display. That way switching between kg and lb never corrupts data.

---

## 11. Suggested roadmap

### MVP (v0.1)
- Exercise library (free-exercise-db) + custom exercises
- Log a workout: sets with weight/reps, set types, "previous" column, rest timer
- Workout history + edit/delete
- Live PR detection (est. 1RM, heaviest, rep PRs, set volume) + toast + medals on the summary
- Workout summary screen with a celebration
- kg/lb setting, JSON export/import
- Installable PWA that works offline

### v0.2
- Routines/templates; start a workout from a routine
- Per-exercise progress charts
- Weekly goal + weekly streak + calendar heatmap
- Milestones/achievements with tiers + badge gallery
- Plate calculator

### v0.3
- Body measurements + progress photos
- User-defined goals with progress bars
- Muscle-group volume / body heat map
- Shareable PR/milestone image cards
- Supersets, RPE/RIR

### Later
- Strength-level standards, monthly/yearly recap
- Cloud sync + accounts (e.g. Supabase/Firebase) so data survives a lost phone
- Programs with automatic progression (Liftosaur/Boostcamp style)
- Live tracking (heart rate, wearables)

---

## Sources

**Apps and features**
- [Hevy: Live PR notifications](https://help.hevyapp.com/hc/en-us/articles/36012016405655-Hevy-Live-PR-Notifications-Get-Instant-Updates-on-Your-Best-Lifts) · [Live PR feature](https://www.hevyapp.com/features/live-pr/) · [Set records vs PRs](https://help.hevyapp.com/hc/en-us/articles/38279531346455-Set-Records-vs-Personal-Records)
- [Hevy: Calendar and streak](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features) · [Body measurements & photos](https://help.hevyapp.com/hc/en-us/articles/35385479603479-Body-Composition-Tracking-Measurements-and-Progress-Photos) · [Yearly review](https://help.hevyapp.com/hc/en-us/articles/35700454899991-Discover-Your-Hevy-Training-Stats-with-the-Yearly-Review)
- [Hevy: Set types](https://www.hevyapp.com/features/workout-set-types/) · [Track workouts](https://www.hevyapp.com/features/track-workouts/) · [Workout settings](https://www.hevyapp.com/features/workout-settings/)
- [Boostcamp: workout tracking comparison](https://www.boostcamp.app/compare/workout-tracking) · [RPE/RIR](https://www.boostcamp.app/best/rpe-rir)
- [Repreturn: Strong vs Hevy](https://repreturn.com/strong-app-vs-hevy/) · [Lyfta: Hevy vs Strong](https://www.lyfta.app/vs/hevy-vs-strong) · [Setgraph: Hevy vs Strong 2026](https://setgraph.app/es/articles/hevy-vs-strong-app-comparison-2026)
- [Jefit vs Fitbod](https://www.jefit.com/blog/jefit-vs-fitbod) · [How Fitbod works](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works) · [Fitbod milestones](https://help.fitbod.me/hc/en-us/articles/24122892764055-Fitbod-Milestones)
- [MacroFactor: set types](https://help.macrofactorapp.com/en/articles/317-logging-different-types-of-sets)
- [Tonal achievements](https://tonal.com/blogs/all/celebrate-your-progress-introducing-new-tonal-achievements-prs-and-summaries/) · [Volt achievements](https://help.voltathletics.com/how-do-achievements-work-within-the-app) · [Everfit achievement settings](https://help.everfit.io/en/articles/11501307-achievement-settings)

**UX**
- [Screensdesign: workout tracker design examples](https://screensdesign.com/articles/workout-tracker-app-design-examples/) · [Rest timer UX](https://screensdesign.com/articles/workout-app-rest-timer-controls-ux/)
- [WHOOP community: rest timer workflow feedback](https://www.community.whoop.com/t/strength-trainer-feedback-rest-timer-workflow-progression-targets-notes-measurements-and-exercise-mapping/14544)

**Gamification and streaks**
- [Yu-kai Chou: streak design, motivation & burnout](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/) · [UX Collective: reframing Duolingo streaks](https://uxdesign.cc/3-reframing-streaks-on-duolingo-5-ideas-for-a-more-healthy-and-flexible-approach-to-language-8fd89545771e)
- [Lazyweb: how common are streaks in fitness apps](https://labs.lazyweb.com/research/how-common-are-streaks-in-health-and-fitness-apps.md)
- [Sahha: gamification and behavioural nudges](https://sahha.ai/blog/gamification-behavioral-nudges-health-apps/) · [PACIS 2018: gamification in 2,462 fitness apps](https://core.ac.uk/download/301376144.pdf)
- [Strava badges (Illo)](https://www.itsnicethat.com/news/illo-strava-graphic-design-illustration-200123) · [Strava Year in Sport built with Rive](https://rive.app/blog/strava-year-in-sport-built-with-rive)

**Strength science**
- [Fitness Volt: e1RM formulas compared](https://fitnessvolt.com/rpe-training/compare/e1rm-formulas/) · [Topend Sports: 1RM calculator](https://www.topendsports.com/testing/calculators/1repmax.htm)
- [Strength Level standards](https://strengthlevel.com/strength-standards/bench-press-vs-bodyweight-calf-raise/kg) · [SimpliFaster: relative strength standards](https://simplifaster.com/articles/applying-relative-strength-standards/)

**Tech**
- [free-exercise-db (Unlicense)](https://github.com/yuhonas/free-exercise-db)
- [alexanderop/workouttracker (Vite + Dexie PWA)](https://cdn.jsdelivr.net/gh/alexanderop/workouttracker@main/README.md) · [Building true offline-first PWAs](https://alamb-hex.github.io/blog/2026/01/21/building-true-offline-first-pwas)
- [firt.dev: iOS PWA compatibility](https://firt.dev/notes/pwa-ios/) · [MagicBell: PWA iOS limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [Apple forums: data persistence beyond 7 days](https://developer.apple.com/forums/thread/710157)
- [canvas-confetti tutorial](https://dev.to/kalama_ayubu_920a009aeba9/how-to-add-a-confetti-celebration-effect-to-your-web-app-using-canvas-confetti-onh)
