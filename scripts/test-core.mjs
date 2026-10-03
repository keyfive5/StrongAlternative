// Core maths: 1RM, records, PRs, the coach, plates, warm-ups, library, stats.
import { describe, eq, ok, report } from './harness.mjs';
import { e1rm, exerciseHistory, records, workoutPrs, muscleSets, weekStreak, weeklyBuckets, weekStart } from '../src/core/analytics.ts';
import { suggest, repRange, stallCount, workingWeight, loadable } from '../src/core/coach.ts';
import { loadBar, warmupRamp } from '../src/core/plates.ts';
import { LIBRARY, nameKey } from '../src/core/library.ts';
import { PROGRAMS } from '../src/core/templates.ts';
import { fmtNum, fmtClock, parseNum, toDisplay, fromDisplay, fmtWeight } from '../src/core/units.ts';

const DAY = 86400000;
const T0 = new Date(2026, 0, 5, 18, 0).getTime(); // a Monday
let n = 0;
const set = (weight, reps, extra = {}) => ({ id: 's' + n++, type: 'normal', weight, reps, done: true, ...extra });
const workout = (day, exerciseId, sets, extra = {}) => ({
  id: 'w' + day + exerciseId,
  name: 'Day ' + day,
  start: T0 + day * DAY,
  end: T0 + day * DAY + 3600000,
  exercises: [{ id: 'we' + day, exerciseId, sets }],
  ...extra,
});

const bench = LIBRARY.find((e) => e.id === 'bench-press-barbell');
const curl = LIBRARY.find((e) => e.id === 'bicep-curl-dumbbell');
const pullup = LIBRARY.find((e) => e.id === 'pull-up');
const assisted = LIBRARY.find((e) => e.id === 'pull-up-assisted');
const plank = LIBRARY.find((e) => e.id === 'plank');

describe('library', () => {
  const ids = LIBRARY.map((e) => e.id);
  eq(new Set(ids).size, ids.length, 'every exercise id is unique');
  ok(LIBRARY.length >= 200, `library is large (${LIBRARY.length})`);
  ok(bench && bench.name === 'Bench Press (Barbell)', 'bench press uses Movement (Equipment) naming');
  ok(pullup && pullup.kind === 'reps', 'pull up records reps');
  ok(assisted && assisted.kind === 'assisted', 'assisted pull up is assisted');
  ok(plank && plank.kind === 'time', 'plank is timed');
  eq(LIBRARY.find((e) => e.id === 'lunge-bodyweight')?.kind, 'reps', 'a bodyweight variant of a loaded lift records reps');
  eq(nameKey('Pull-ups'), nameKey('Pull Up'), 'pull-ups == pull up');
  eq(nameKey('Biceps Curl (Dumbbell)'), nameKey('Bicep Curl (Dumbbell)'), 'biceps == bicep');
  eq(nameKey('Skull Crushers (EZ Bar)'), nameKey('Skullcrusher (EZ Bar)'), 'skull crushers == skullcrusher');
});

describe('units', () => {
  eq(fmtNum(62.5), '62.5', 'trims trailing zeros');
  eq(fmtNum(100), '100', 'integers stay integers');
  eq(fmtNum(0.30000000000000004), '0.3', 'float dust removed');
  eq(fmtClock(95), '1:35', 'clock m:ss');
  eq(fmtClock(3725), '1:02:05', 'clock h:mm:ss');
  eq(parseNum('62,5'), 62.5, 'comma decimals accepted');
  eq(parseNum(''), undefined, 'empty is undefined');
  eq(parseNum('-3'), undefined, 'negatives rejected');
  eq(fmtWeight(fromDisplay(225, 'lb'), 'lb'), '225', '225 lb round-trips through kg storage');
  eq(fmtWeight(fromDisplay(137.5, 'lb'), 'lb'), '137.5', '137.5 lb round-trips');
  ok(Math.abs(toDisplay(100, 'lb') - 220.462) < 0.001, '100 kg = 220.46 lb');
});

describe('e1rm', () => {
  eq(e1rm(100, 1), 100, 'a single is the 1RM');
  ok(Math.abs(e1rm(100, 5) - 116.667) < 0.01, 'Epley at 5 reps');
  ok(Math.abs(e1rm(100, 10) - 133.333) < 0.01, 'Epley at 10 reps');
  ok(Math.abs(e1rm(100, 20) - 166.667) < 0.01, 'still estimated at 20 reps');
  eq(e1rm(100, 25), undefined, 'no estimate past 20 reps');
  eq(e1rm(0, 5), undefined, 'no estimate without load');
  ok(e1rm(100, 3, 7) > e1rm(100, 3, 10), 'RPE 7 triple estimates higher than RPE 10 triple');
  eq(e1rm(100, 3, 10), e1rm(100, 3), 'RPE 10 changes nothing');
});

describe('records', () => {
  const ws = [
    workout(0, bench.id, [set(80, 8), set(80, 8), set(80, 7)]),
    workout(3, bench.id, [set(100, 1)]),
    workout(7, bench.id, [set(85, 5), set(85, 5), set(70, 12)]),
  ];
  const hist = exerciseHistory(ws, bench.id);
  eq(hist.length, 3, 'three sessions');
  const rec = records(hist);
  eq(rec.heaviest.value, 100, 'heaviest weight');
  ok(Math.abs(rec.bestE1rm.value - e1rm(80, 8)) < 1e-9, 'best e1rm from 80x8');
  eq(rec.bestSessionVolume.value, 80 * 23, 'best session volume');
  eq(rec.bestSetVolume.value, 70 * 12, 'best single-set volume');
  eq(rec.repMaxes.map((r) => r.reps), [1, 5, 8, 12], 'rep maxes 1,5,8,12; 7 is dominated by 8x80');
  ok(!rec.repMaxes.some((r) => r.reps === 7), '80x7 is not a 7RM when 80x8 exists');
});

describe('PR detection', () => {
  const ws = [
    workout(0, bench.id, [set(80, 5), set(80, 5)]),
    workout(3, bench.id, [set(80, 6), set(80, 6)]),
    workout(7, bench.id, [set(90, 2), set(60, 15)]),
  ];
  const first = workoutPrs(ws[0], ws);
  eq(first.length, 0, 'a first session sets no PRs');
  const second = workoutPrs(ws[1], ws);
  ok(second.some((p) => p.kind === 'e1rm'), '80x6 beats 80x5: e1rm PR');
  ok(second.some((p) => p.kind === 'volume'), 'volume PR');
  ok(second.some((p) => p.kind === 'repmax' && p.reps === 6), '6-rep max PR');
  ok(!second.some((p) => p.kind === 'weight'), 'no heaviest-weight PR at the same weight');
  const third = workoutPrs(ws[2], ws);
  ok(third.some((p) => p.kind === 'weight' && p.value === 90), 'heaviest weight PR at 90');
  ok(!third.some((p) => p.kind === 'repmax' && p.reps === 2), '90x2 reported once, as heaviest, not again as a 2RM');
  ok(third.some((p) => p.kind === 'repmax' && p.reps === 15), '60x15 is a new 15RM');
  const warm = workout(9, bench.id, [set(120, 1, { type: 'warmup' }), set(50, 5)]);
  ok(!workoutPrs(warm, [...ws, warm]).some((p) => p.kind === 'weight'), 'warm-up sets never count as PRs');
  const undone = workout(10, bench.id, [set(150, 5, { done: false }), set(50, 5)]);
  ok(!workoutPrs(undone, [...ws, undone]).some((p) => p.kind === 'weight'), 'unticked sets never count');
});

describe('coach: double progression', () => {
  const s1 = suggest(bench, [], 'kg');
  eq(s1.action, 'first', 'no history: first session');
  eq(repRange(bench), [5, 8], 'barbell compound defaults to 5-8');
  eq(repRange(curl), [10, 15], 'dumbbell isolation defaults to 10-15');

  let h = exerciseHistory([workout(0, bench.id, [set(80, 8), set(80, 8), set(80, 8)])], bench.id);
  let s = suggest(bench, h, 'kg');
  eq(s.action, 'increase', 'all sets at top of range: add weight');
  eq(s.sets.map((x) => x.weight), [82.5, 82.5, 82.5], 'adds 2.5 kg');
  eq(s.sets.map((x) => x.reps), [5, 5, 5], 'restarts at the bottom of the range');

  h = exerciseHistory([workout(0, bench.id, [set(80, 8), set(80, 7), set(80, 6)])], bench.id);
  s = suggest(bench, h, 'kg');
  eq(s.action, 'reps', 'short of the top: add reps');
  eq(s.sets.map((x) => x.reps), [8, 8, 7], 'one more rep per set, capped at the top');
  eq(s.sets.map((x) => x.weight), [80, 80, 80], 'weight held');

  h = exerciseHistory([workout(0, bench.id, [set(80, 8, { type: 'warmup' }), set(60, 10, { type: 'warmup' }), set(80, 8), set(80, 8), set(70, 12, { type: 'drop' })])], bench.id);
  s = suggest(bench, h, 'kg');
  eq(s.action, 'increase', 'warm-ups and drop sets ignored by the coach');
  eq(s.sets.length, 2, 'two working sets in, two targets out');

  const lbH = exerciseHistory([workout(0, bench.id, [set(fromDisplay(135, 'lb'), 8), set(fromDisplay(135, 'lb'), 8)])], bench.id);
  const lb = suggest(bench, lbH, 'lb');
  eq(lb.sets.map((x) => fmtWeight(x.weight, 'lb')), ['140', '140'], 'in pounds, 135 goes to 140');
});

describe('coach: stalls and deloads', () => {
  const ws = [
    workout(0, bench.id, [set(100, 6), set(100, 6)]),
    workout(3, bench.id, [set(100, 6), set(100, 6)]),
    workout(7, bench.id, [set(100, 6), set(100, 5)]),
    workout(10, bench.id, [set(100, 6), set(100, 6)]),
  ];
  let h = exerciseHistory(ws.slice(0, 2), bench.id);
  eq(stallCount(h), 1, 'one flat session');
  h = exerciseHistory(ws.slice(0, 3), bench.id);
  eq(stallCount(h), 2, 'two flat sessions');
  eq(suggest(bench, h, 'kg').action, 'hold', 'two stalls: hold and warn');
  h = exerciseHistory(ws, bench.id);
  eq(stallCount(h), 3, "losing a rep then regaining it is still a stall");
  const s = suggest(bench, h, 'kg');
  eq(s.action, 'deload', 'three stalls: deload');
  eq(s.sets[0].weight, 90, 'deload is 10%');
  const progressing = exerciseHistory([workout(0, bench.id, [set(100, 5)]), workout(3, bench.id, [set(100, 6)]), workout(6, bench.id, [set(100, 7)])], bench.id);
  eq(stallCount(progressing), 0, 'adding a rep each time is never a stall');
  const reset = exerciseHistory([workout(0, bench.id, [set(100, 5)]), workout(3, bench.id, [set(90, 5)]), workout(6, bench.id, [set(90, 5)])], bench.id);
  eq(stallCount(reset), 1, 'a deliberate weight drop resets the count');
  eq(workingWeight([set(60, 10, { type: 'warmup' }), set(100, 5), set(100, 5), set(110, 1)]), 100, 'working weight is the most common load');
});

describe('coach: other kinds', () => {
  let h = exerciseHistory([workout(0, pullup.id, [set(undefined, 8), set(undefined, 7)])], pullup.id);
  let s = suggest(pullup, h, 'kg');
  eq(s.action, 'reps', 'bodyweight: add reps');
  eq(s.sets.map((x) => x.reps), [9, 8], 'one more rep each');
  h = exerciseHistory([workout(0, pullup.id, [set(undefined, 12), set(undefined, 12)])], pullup.id);
  eq(suggest(pullup, h, 'kg').action, 'increase', 'bodyweight past the range: add load');
  h = exerciseHistory([workout(0, assisted.id, [set(30, 12), set(30, 12)])], assisted.id);
  s = suggest(assisted, h, 'kg');
  eq(s.action, 'increase', 'assisted at the top of the range');
  ok(s.sets[0].weight < 30, 'progress means LESS assistance');
  h = exerciseHistory([workout(0, plank.id, [{ id: 'p', type: 'normal', seconds: 45, done: true }])], plank.id);
  s = suggest(plank, h, 'kg');
  eq(s.action, 'time', 'timed: hold longer');
  eq(s.sets[0].seconds, 50, '45s → 50s');
  eq(loadable(fromDisplay(137.3, 'lb'), 'lb'), fromDisplay(137, 'lb'), 'loadable rounds in the display unit');
});

describe('plates', () => {
  const kg = [{ weight: 25, pairs: 4 }, { weight: 20, pairs: 4 }, { weight: 10, pairs: 2 }, { weight: 5, pairs: 2 }, { weight: 2.5, pairs: 2 }, { weight: 1.25, pairs: 2 }];
  let l = loadBar(100, 20, kg);
  eq(l.perSide, [25, 10, 5], '100 kg = 25+10+5 a side');
  eq(l.remainder, 0, 'exact');
  l = loadBar(102.5, 20, kg);
  eq(l.perSide, [25, 10, 5, 1.25], '102.5 adds the 1.25s');
  l = loadBar(101, 20, kg);
  eq(l.total, 100, 'unbuildable weights round down to what can be built');
  eq(l.remainder, 1, 'and say how far off they are');
  l = loadBar(260, 20, [{ weight: 25, pairs: 2 }, { weight: 20, pairs: 10 }]);
  eq(l.perSide, [25, 25, 20, 20, 20], 'respects how many pairs exist');
  eq(loadBar(15, 20, kg).perSide, [], 'below the bar: no plates');
  const lb = [{ weight: 45, pairs: 4 }, { weight: 25, pairs: 2 }, { weight: 10, pairs: 2 }, { weight: 5, pairs: 2 }, { weight: 2.5, pairs: 2 }];
  eq(loadBar(225, 45, lb).perSide, [45, 45], '225 lb = two plates');
  eq(loadBar(185, 45, lb).perSide, [45, 25], '185 lb');
});

describe('warm-ups', () => {
  const kg = [{ weight: 20, pairs: 4 }, { weight: 10, pairs: 2 }, { weight: 5, pairs: 2 }, { weight: 2.5, pairs: 2 }, { weight: 1.25, pairs: 2 }];
  const r = warmupRamp(140, 20, kg);
  eq(r[0].weight, 20, 'starts with the empty bar');
  ok(r.every((s, i) => i === 0 || s.weight > r[i - 1].weight), 'weights rise');
  ok(r.every((s, i) => i === 0 || s.reps <= r[i - 1].reps), 'reps fall');
  ok(r.every((s) => s.weight < 140), 'never reaches the working weight');
  ok(r.every((s) => (s.weight - 20) % 2.5 === 0), 'every step is loadable');
  const light = warmupRamp(30, 20, kg);
  ok(light.length <= 2, 'a light working weight needs only a step or two');
  eq(warmupRamp(0, 20, kg), [], 'no working weight, no ramp');
});

describe('stats', () => {
  const ex = new Map(LIBRARY.map((e) => [e.id, e]));
  const ws = [workout(0, bench.id, [set(80, 8), set(80, 8), set(40, 10, { type: 'warmup' })])];
  const m = muscleSets(ws, ex, T0 - DAY, T0 + 7 * DAY);
  eq(m.get('chest'), 2, 'two working sets for chest');
  eq(m.get('triceps'), 1, 'secondary muscles count half');
  const weeks = [0, 7, 14, 28].map((d) => workout(d, bench.id, [set(80, 5)]));
  eq(weekStreak(weeks, 1, T0 + 15 * DAY), 3, 'three consecutive weeks');
  eq(weekStreak(weeks, 1, T0 + 29 * DAY), 1, 'a gap breaks the streak');
  eq(weekStreak(weeks, 1, T0 + 35 * DAY), 1, 'an empty current week does not break it yet');
  const b = weeklyBuckets(weeks, 5, 1, T0 + 29 * DAY);
  eq(b.map((x) => x.workouts), [1, 1, 1, 0, 1], 'weekly buckets include empty weeks');
  eq(new Date(weekStart(T0 + 2 * DAY, 1)).getDay(), 1, 'weeks start Monday');
  eq(new Date(weekStart(T0 + 2 * DAY, 0)).getDay(), 0, 'or Sunday');
});

describe('templates', () => {
  const ids = new Set(LIBRARY.map((e) => e.id));
  for (const p of PROGRAMS) for (const d of p.days) for (const [id] of d.exercises) ok(ids.has(id), `${p.name} / ${d.name}: ${id} exists`);
});

report('core');
