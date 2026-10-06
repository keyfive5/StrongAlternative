// Six months of believable push/pull/legs training, for "explore with sample
// data" on first launch, and for the screenshots.
//
// A coach has nothing to say about an empty log, so a new user — or an App
// Review tester — would otherwise see only "first session" everywhere. The
// history is written as a Strong-style CSV and run through the real importer,
// so it exercises the same path real imports take. Every record it creates is
// flagged `sample` and can be removed in one tap.

import { importCsv } from './csv.ts';
import { PROGRAMS, programRoutines } from './templates.ts';
import type { Exercise, Measurement, Routine, Workout } from './types.ts';

// Exercise: start weight, rep range, increment, sets.
const PLAN: Record<string, [string, number, number, number, number, number][]> = {
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

/** One lift stalls for the last two months, so the coach has a plateau to diagnose. */
const STALLS = new Set(['Overhead Press (Barbell)']);

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

export function sampleCsv(now = Date.now(), days = 182): string {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const state: Record<string, { w: number; reps: number }> = {};
  for (const day of Object.values(PLAN)) for (const [name, w, lo] of day) state[name] = { w, reps: lo };

  const rows: string[] = ['Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'];
  const order = ['Push', 'Pull', 'Legs'];
  const start = new Date(now);
  start.setHours(18, 0, 0, 0);
  start.setDate(start.getDate() - days);
  let n = 0;
  for (let d = 0; d < days; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    if (![1, 2, 4, 5].includes(date.getDay())) continue; // four days a week
    if (rand() < 0.08) continue; // a missed session now and then
    const name = order[n++ % 3];
    date.setHours(17 + Math.floor(rand() * 3), Math.floor(rand() * 60));
    if (date.getTime() > now) continue;
    const when = stamp(date);
    const duration = `${Math.floor(55 + rand() * 30)}m`;
    const line = (ex: string, setOrder: string, w: number, r: number, rpe = '') =>
      rows.push([when, `"${name}"`, duration, `"${ex}"`, setOrder, w, r, 0, 0, '""', '""', rpe].join(','));
    for (const [ex, , lo, hi, inc, sets] of PLAN[name]) {
      const s = state[ex];
      if (ex.includes('(Barbell)') && s.w > 40) {
        line(ex, 'W', Math.round((s.w * 0.5) / 2.5) * 2.5, 5);
        line(ex, 'W', Math.round((s.w * 0.75) / 2.5) * 2.5, 3);
      }
      const reps: number[] = [];
      for (let i = 0; i < sets; i++) {
        const fatigue = i >= 2 && rand() < 0.4 ? 1 : 0;
        const bad = rand() < 0.07 ? 1 : 0;
        reps.push(Math.max(lo - 1, Math.min(hi, s.reps - fatigue - bad)));
      }
      reps.forEach((r, i) => line(ex, String(i + 1), s.w, r, i === 0 && rand() < 0.3 ? String(7 + Math.floor(rand() * 3)) : ''));
      if (STALLS.has(ex) && d > days - 60) continue;
      if (reps.every((r) => r >= hi)) {
        if (inc) {
          s.w += inc;
          s.reps = lo;
        } else s.reps = hi + 1;
      } else if (rand() < 0.75) s.reps = Math.min(hi, s.reps + 1);
    }
  }
  return rows.join('\n');
}

export interface SampleData {
  workouts: Workout[];
  routines: Routine[];
  measurements: Measurement[];
  exercises: Exercise[];
}

export function sampleData(existing: Exercise[], now = Date.now()): SampleData {
  const res = importCsv(sampleCsv(now), existing, [], 'kg');
  const routines = programRoutines(PROGRAMS[0]).map((r) => ({ ...r, sample: true }));
  for (const w of res.workouts) {
    w.sample = true;
    w.routineId = routines.find((r) => r.name === w.name)?.id;
  }
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const DAY = 86400000;
  const measurements: Measurement[] = [
    ...Array.from({ length: 14 }, (_, i) => ({
      id: `sample-bw-${i}`,
      kind: 'bodyweight' as const,
      at: now - (13 - i) * 13 * DAY,
      value: Math.round((80.5 + i * 0.22 + (rand() - 0.5) * 0.6) * 10) / 10,
      sample: true,
    })),
    { id: 'sample-waist-1', kind: 'waist', at: now - 90 * DAY, value: 84, sample: true },
    { id: 'sample-waist-2', kind: 'waist', at: now - 5 * DAY, value: 83, sample: true },
  ];
  return { workouts: res.workouts, routines, measurements, exercises: res.newExercises };
}
