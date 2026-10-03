// Six months of believable push/pull/legs training, written as a Strong CSV
// and then run through the real importer. Used for screenshots and for
// exercising every chart, record and coach state with real-looking data.
//
//   node --experimental-strip-types scripts/make-demo.mjs
//
// Writes .scratch/demo-strong.csv and .scratch/demo-db.json.
import fs from 'fs';
import { importCsv } from '../src/core/csv.ts';
import { DEFAULT_SETTINGS } from '../src/core/types.ts';
import { PROGRAMS, programRoutines } from '../src/core/templates.ts';

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Exercise: start weight, rep range, increment, sets. Double progression with
// the occasional bad day, so the coach has stalls to find.
const plan = {
  Push: [
    ['Bench Press (Barbell)', 70, 5, 8, 2.5, 4],
    ['Overhead Press (Barbell)', 42.5, 5, 8, 2.5, 3],
    ['Incline Bench Press (Dumbbell)', 24, 8, 12, 2, 3],
    ['Lateral Raise (Dumbbell)', 8, 10, 15, 2, 3],
    ['Triceps Pushdown - Rope (Cable)', 25, 10, 15, 2.5, 3],
  ],
  Pull: [
    ['Deadlift (Barbell)', 110, 5, 8, 5, 3],
    ['Pull Up', 0, 6, 12, 0, 3],
    ['Seated Row (Cable)', 55, 8, 12, 2.5, 3],
    ['Face Pull (Cable)', 20, 10, 15, 2.5, 3],
    ['Bicep Curl (Dumbbell)', 12, 10, 15, 2, 3],
  ],
  Legs: [
    ['Squat (Barbell)', 90, 5, 8, 2.5, 4],
    ['Romanian Deadlift (Barbell)', 80, 8, 12, 2.5, 3],
    ['Leg Press', 140, 10, 15, 10, 3],
    ['Seated Leg Curl (Machine)', 40, 10, 15, 2.5, 3],
    ['Standing Calf Raise (Machine)', 60, 10, 15, 5, 4],
  ],
};
const state = {};
for (const day of Object.values(plan)) for (const [name, w, lo] of day) state[name] = { w, reps: lo };

const rows = [];
const days = ['Push', 'Pull', 'Legs'];
const start = new Date();
start.setHours(18, 0, 0, 0);
start.setDate(start.getDate() - 182);
let n = 0;
const stalls = new Set(['Overhead Press (Barbell)']);
for (let d = 0; d < 182; d++) {
  const date = new Date(start);
  date.setDate(start.getDate() + d);
  const dow = date.getDay();
  if (![1, 2, 4, 5].includes(dow)) continue; // four days a week
  if (rand() < 0.08) continue; // missed session
  const name = days[n % 3];
  n++;
  date.setHours(17 + Math.floor(rand() * 3), Math.floor(rand() * 60));
  const stamp = date.toISOString().slice(0, 10) + ' ' + date.toTimeString().slice(0, 8);
  const duration = `${Math.floor(55 + rand() * 30)}m`;
  for (const [ex, , lo, hi, inc, sets] of plan[name]) {
    const s = state[ex];
    // Warm-ups on the big barbell lifts.
    if (ex.includes('(Barbell)') && s.w > 40) {
      for (const [pct, r] of [[0.5, 5], [0.75, 3]]) rows.push([stamp, name, duration, ex, 'W', Math.round((s.w * pct) / 2.5) * 2.5, r, '', '']);
    }
    const stalled = stalls.has(ex) && d > 120;
    const reps = [];
    for (let i = 0; i < sets; i++) {
      const fatigue = i >= 2 && rand() < 0.4 ? 1 : 0;
      const bad = rand() < 0.07 ? 1 : 0;
      reps.push(Math.max(lo - 1, Math.min(hi, s.reps - fatigue - bad)));
    }
    reps.forEach((r, i) => rows.push([stamp, name, duration, ex, String(i + 1), s.w, r, i === 0 && rand() < 0.3 ? String(7 + Math.floor(rand() * 3)) : '', '']));
    if (stalled) continue;
    if (reps.every((r) => r >= hi)) {
      if (inc) {
        s.w += inc;
        s.reps = lo;
      } else s.reps = hi + 1;
    } else if (rand() < 0.75) s.reps = Math.min(hi, s.reps + 1);
  }
}

const head = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
const csv = [head, ...rows.map(([date, wn, dur, ex, order, w, r, rpe]) => [date, `"${wn}"`, dur, `"${ex}"`, order, w, r, 0, 0, '""', '""', rpe].join(','))].join('\n');
fs.mkdirSync('.scratch', { recursive: true });
fs.writeFileSync('.scratch/demo-strong.csv', csv);

const res = importCsv(csv, [], [], 'kg');
const routines = programRoutines(PROGRAMS[0]);
// Point the imported workouts at the routines so "Up next" rotates properly.
for (const w of res.workouts) w.routineId = routines.find((r) => r.name === w.name)?.id;
const db = {
  version: 1,
  exercises: res.newExercises,
  workouts: res.workouts,
  routines,
  measurements: Array.from({ length: 14 }, (_, i) => ({
    id: 'm' + i,
    kind: 'bodyweight',
    at: Date.now() - (13 - i) * 13 * 86400000,
    value: 80.5 + i * 0.22 + (rand() - 0.5) * 0.6,
  })).concat([{ id: 'w1', kind: 'waist', at: Date.now() - 90 * 86400000, value: 84 }, { id: 'w2', kind: 'waist', at: Date.now() - 5 * 86400000, value: 83 }]),
  settings: { ...DEFAULT_SETTINGS },
};
fs.writeFileSync('.scratch/demo-db.json', JSON.stringify(db));
console.log(`${res.workouts.length} workouts, ${res.sets} sets, ${res.newExercises.length} custom exercises`);
