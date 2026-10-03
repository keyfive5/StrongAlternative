# Overload — Lift Tracker

A weightlifting log for iPhone built around progressive overload: every
exercise tells you what to lift today, based on what you actually lifted last
time. Every feature is free. No subscription, no account, no ads, no network.

## What it does that a paid tier usually holds back

| | |
|---|---|
| Routines | Unlimited, plus Push/Pull/Legs, Upper/Lower, 5×5 and Full Body starters |
| Charts | Estimated 1RM, heaviest weight, volume and reps per exercise, with trend |
| Records | e1RM, heaviest, best set, best session, rep maxes 1–15, announced live |
| Body | Body weight, body fat and nine measurements with charts |
| Tools | Plate calculator (uses the plates you own), warm-up ramp |
| Data | Import Strong and Hevy CSV exports; export Strong-compatible CSV; full backups |

## The coach

`src/core/coach.ts` runs double progression per exercise: hold the weight
until every working set reaches the top of the rep range, then add the
smallest sensible load and restart at the bottom. It counts sessions since the
last new best at the current weight — so losing a rep and winning it back is
not mistaken for progress — and after three it prescribes a 10% deload.
Assisted movements progress by *removing* assistance; bodyweight movements
progress reps, then suggest adding load.

## Layout

- `src/core/` — pure TypeScript, no React: analytics, coach, CSV, plates,
  library, templates. Runs under `node --experimental-strip-types`.
- `src/state/store.ts` — the observable store and persistence.
- `src/platform/` — file storage (atomic write + backup copy) and file pickers.
- `src/ui/` — screens and components.
- `scripts/` — tests, asset and screenshot generation, App Store Connect
  automation. See `SHIP.md`.

## Tests

```bash
npm test
```

215 assertions over the 1RM maths, records and PR detection, every coach
path, plate loading, warm-up ramps, weekly stats, the starter programmes, and
CSV import/export across Strong's three export formats and Hevy's, including
round trips in both units.
