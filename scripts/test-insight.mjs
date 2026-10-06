// Readiness, plateau diagnosis, starting estimates, goal ranges, sample data.
import fs from 'fs';
import { describe, eq, ok, report } from './harness.mjs';
import { allHistories, exerciseHistory } from '../src/core/analytics.ts';
import { repRange, suggest, stallCount } from '../src/core/coach.ts';
import { sampleData } from '../src/core/demo.ts';
import { alternativesFor, baselineE1rm, diagnose, readiness, startingEstimate } from '../src/core/insight.ts';
import { LIBRARY } from '../src/core/library.ts';
import { fmtWeight } from '../src/core/units.ts';

const DAY = 86400000;
const T0 = new Date(2026, 0, 5, 18).getTime();
let n = 0;
const set = (weight, reps, extra = {}) => ({ id: 's' + n++, type: 'normal', weight, reps, done: true, ...extra });
const open = (weight, reps) => ({ id: 's' + n++, type: 'normal', weight, reps, done: false });
const workout = (day, exerciseId, sets) => ({
  id: `w${day}${exerciseId}`,
  name: 'W',
  start: T0 + day * DAY,
  end: T0 + day * DAY + 3600e3,
  exercises: [{ id: 'e' + day, exerciseId, sets }],
});
const ex = (id) => LIBRARY.find((e) => e.id === id);
const bench = ex('bench-press-barbell');
const incline = ex('incline-bench-press-dumbbell');
const ohp = ex('overhead-press-barbell');

const benchHistory = exerciseHistory(
  [0, 3, 7].map((d) => workout(d, bench.id, [set(100, 5), set(100, 5), set(100, 5)])),
  bench.id,
);

describe('goal ranges', () => {
  eq(repRange(bench), [5, 8], 'general: heavy barbell 5–8');
  eq(repRange(bench, 'strength'), [3, 5], 'strength: heavy barbell 3–5');
  eq(repRange(bench, 'muscle'), [6, 10], 'muscle: heavy barbell 6–10');
  eq(repRange(incline, 'muscle'), [8, 12], 'muscle: dumbbell compound 8–12');
  eq(repRange({ ...bench, repMin: 2, repMax: 4 }, 'muscle'), [2, 4], "an exercise's own range always wins");
  eq(suggest(bench, benchHistory, 'kg', { goal: 'strength' }).action, 'increase', 'at 5 reps a strength goal already says go up');
  ok(suggest(bench, benchHistory, 'kg', { goal: 'general' }).action !== 'increase', 'a general goal wants more reps first');
});

describe('readiness', () => {
  ok(Math.abs(baselineE1rm(benchHistory) - 100 * (1 + 5 / 30)) < 1e-9, 'baseline is the recent best e1RM');
  eq(readiness(bench, benchHistory, [set(100, 5), open(100, 5)], 'kg'), null, 'a normal day says nothing');
  const low = readiness(bench, benchHistory, [set(100, 2), open(100, 5), open(100, 5)], 'kg');
  ok(low && low.kind === 'low', '100 x 2 when 100 x 5 is usual is an off day');
  ok(low.weightKg < 100, 'and the remaining sets come down');
  ok(low.weightKg % 2.5 === 0, 'to a weight a barbell can be loaded to');
  const high = readiness(bench, benchHistory, [set(100, 9), open(100, 5)], 'kg');
  ok(high && high.kind === 'high', '100 x 9 is a strong day');
  ok(high.weightKg > 100, 'and suggests more weight');
  eq(readiness(bench, benchHistory, [set(100, 2)], 'kg'), null, 'nothing to say with no sets left');
  eq(readiness(bench, benchHistory, [set(60, 10, { type: 'warmup' }), open(100, 5)], 'kg'), null, 'warm-ups never count');
  eq(readiness(bench, benchHistory.slice(0, 1), [set(100, 1), open(100, 5)], 'kg'), null, 'needs two sessions of baseline');
  eq(readiness(ex('pull-up'), benchHistory, [set(0, 3), open(0, 5)], 'kg'), null, 'only for loaded lifts');
});

describe('diagnosis', () => {
  const flat = exerciseHistory(
    [0, 10, 20, 30].map((d) => workout(d, ohp.id, [set(50, 6), set(50, 6)])),
    ohp.id,
  );
  eq(stallCount(flat), 3, 'four flat sessions are a three-session stall');
  const alts = alternativesFor(ohp, LIBRARY, new Set(['overhead-press-dumbbell']));
  ok(alts.length > 0 && alts.every((a) => a.muscle === 'shoulders'), 'alternatives train the same muscle');
  eq(alts[0].id, 'overhead-press-dumbbell', 'a variation the lifter already does comes first');
  ok(!alts.some((a) => a.id.startsWith('face-pull') || a.id.startsWith('lateral-raise')), 'never a different movement that only shares the muscle');
  ok(alts.every((a) => /press/i.test(a.name)), 'presses swap for presses');
  const squatAlts = alternativesFor(ex('squat-barbell'), LIBRARY, new Set());
  ok(squatAlts.length && squatAlts.every((a) => /squat/i.test(a.name)), 'squats swap for squats');
  ok(!squatAlts.some((a) => a.id === 'leg-extension-machine'), 'not leg extensions');
  const rx = diagnose(ohp, flat, { weeklyMuscleSets: 4, weeklyTarget: 10, sessionsPerWeek: 0.7, alternatives: alts });
  const titles = rx.map((r) => r.title);
  ok(titles.includes('Train it twice a week'), 'trained every ten days: train twice a week');
  ok(titles.some((t) => t.startsWith('Give your shoulders')), 'under-volume for the muscle');
  ok(titles.includes('Add a working set'), 'only two working sets');
  ok(titles.some((t) => t.startsWith('Rotate to')), 'ends with a variation');
  const plenty = diagnose(ohp, flat, { weeklyMuscleSets: 26, weeklyTarget: 10, sessionsPerWeek: 2, alternatives: [] });
  ok(plenty.some((r) => r.title === 'Do a little less'), 'too much volume says do less');
  ok(!plenty.some((r) => r.title === 'Train it twice a week'), 'frequent training is not flagged');
  const ppl = diagnose(ohp, flat, { weeklyMuscleSets: 12, weeklyTarget: 10, sessionsPerWeek: 1.15, alternatives: alts });
  ok(!ppl.some((r) => r.title === 'Train it twice a week'), 'every five or six days (a push/pull/legs rotation) is not flagged');
  eq(diagnose(ohp, flat.slice(0, 2), { weeklyMuscleSets: 4, weeklyTarget: 10, sessionsPerWeek: 0.7, alternatives: alts }), [], 'no diagnosis before a stall');
});

describe('starting estimates', () => {
  const histories = new Map([[bench.id, benchHistory]]);
  const est = startingEstimate(incline, histories, 'kg');
  ok(est, 'incline dumbbell press is estimated from bench');
  eq(est.fromId, bench.id, 'from the bench');
  ok(est.weightKg > 20 && est.weightKg < 40, `a sensible per-dumbbell weight (${est.weightKg} kg)`);
  eq(est.reps, 8, 'at the bottom of the range');
  ok(est.weightKg % 2 === 0, 'on the dumbbell rack spacing');
  const barEst = startingEstimate(ex('incline-bench-press-barbell'), histories, 'kg');
  ok(barEst.weightKg % 2.5 === 0, `a barbell estimate is plate-loadable (${barEst.weightKg})`);
  const s = suggest(incline, [], 'kg', { start: { ...est, fromName: 'bench press' } });
  eq(s.action, 'first', 'still a first session');
  eq(s.sets[0].weight, est.weightKg, 'but with a target to start from');
  ok(s.headline.startsWith('Start around'), 'and says so');
  eq(startingEstimate(ex('leg-extension-machine'), histories, 'kg'), undefined, 'machines are not guessed');
  eq(startingEstimate(ex('squat-barbell'), histories, 'kg'), undefined, 'nothing across unrelated families');
  const lb = startingEstimate(incline, histories, 'lb');
  ok(Number.isInteger(Math.round(Number(fmtWeight(lb.weightKg, 'lb')) * 1000) / 1000), 'pounds land on whole numbers');
  const ids = new Set(LIBRARY.map((e) => e.id));
  // Every id in the ratio tables must exist, or an estimate silently never fires.
  const src = fs.readFileSync(new URL('../src/core/insight.ts', import.meta.url), 'utf8');
  const tableIds = [...src.matchAll(/'([a-z0-9-]+)': (?:\d|\{)/g)].map((m) => m[1]);
  ok(tableIds.length > 40, `ratio tables found (${tableIds.length})`);
  for (const id of tableIds) ok(ids.has(id), `ratio table id exists: ${id}`);
});

describe('sample data', () => {
  const now = new Date(2026, 9, 6, 12).getTime();
  const data = sampleData([], now);
  ok(data.workouts.length > 70, `six months of workouts (${data.workouts.length})`);
  ok(data.workouts.every((w) => w.sample && w.end <= now + 3 * 3600e3), 'all flagged sample, none in the future');
  ok(data.routines.length === 3 && data.routines.every((r) => r.sample), 'three sample routines');
  ok(data.workouts.every((w) => w.routineId), 'each workout points at its routine');
  eq(data.exercises.length, 0, 'every sample exercise is in the library');
  ok(data.measurements.every((m) => m.sample), 'measurements flagged sample');
  const h = exerciseHistory(data.workouts, ohp.id);
  ok(stallCount(h) >= 3, 'the overhead press is stalled, so diagnosis has something to show');
  const all = allHistories(data.workouts);
  eq(JSON.stringify(all.get(ohp.id)), JSON.stringify(h), 'allHistories matches exerciseHistory');
  eq(all.size, 15, 'fifteen exercises in the sample log');
  const again = sampleData([], now);
  eq(again.workouts.map((w) => w.start), data.workouts.map((w) => w.start), 'deterministic');
});

report('insight');
