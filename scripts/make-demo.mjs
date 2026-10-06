// Writes the app's own sample history to .scratch/demo-db.json, for the
// screenshots and for browser testing. The same data a user gets from
// "Explore with sample data" on first launch (src/core/demo.ts).
//
//   node --experimental-strip-types scripts/make-demo.mjs
import fs from 'fs';
import { sampleData } from '../src/core/demo.ts';
import { DEFAULT_SETTINGS } from '../src/core/types.ts';

const data = sampleData([]);
const db = {
  version: 1,
  exercises: data.exercises,
  workouts: data.workouts,
  routines: data.routines,
  measurements: data.measurements,
  settings: { ...DEFAULT_SETTINGS, onboarded: true },
};
fs.mkdirSync('.scratch', { recursive: true });
fs.writeFileSync('.scratch/demo-db.json', JSON.stringify(db));
const sets = data.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
console.log(`${data.workouts.length} workouts, ${sets} sets, ${data.exercises.length} custom exercises`);
