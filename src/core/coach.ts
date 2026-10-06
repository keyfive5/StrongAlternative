// The progressive overload coach.
//
// Double progression, the method most lifting programmes reduce to: keep the
// weight until every working set reaches the top of the rep range, then add the
// smallest sensible load and start again from the bottom. Sessions that add
// neither weight nor reps are counted, and after three of them in a row the
// coach calls a stall and prescribes a 10% deload to build back from.

import { isWorking, type Session } from './analytics.ts';
import type { Exercise, Unit, WorkoutSet } from './types.ts';
import { defaultIncrementKg, fmtNum, fromDisplay, roundTo, toDisplay } from './units.ts';

export type CoachAction = 'first' | 'increase' | 'reps' | 'hold' | 'deload' | 'time' | 'cardio';

export interface Target {
  weight?: number;
  reps?: number;
  seconds?: number;
  distance?: number;
}

export interface Suggestion {
  action: CoachAction;
  /** One target per working set, in order. */
  sets: Target[];
  headline: string;
  detail: string;
  /** Consecutive sessions without progress. */
  stalled: number;
  range: [number, number];
}

const ISOLATION = new Set(['biceps', 'triceps', 'forearms', 'calves', 'core', 'shoulders', 'adductors']);

/** What the lifter is training for; it moves every default rep range. */
export type Goal = 'strength' | 'muscle' | 'general';

type Slot = 'heavy' | 'compound' | 'isolation' | 'bodyweight';

const RANGES: Record<Goal, Record<Slot, [number, number]>> = {
  strength: { heavy: [3, 5], compound: [5, 8], isolation: [8, 12], bodyweight: [5, 10] },
  muscle: { heavy: [6, 10], compound: [8, 12], isolation: [10, 15], bodyweight: [8, 15] },
  general: { heavy: [5, 8], compound: [8, 12], isolation: [10, 15], bodyweight: [6, 12] },
};

function slot(ex: Exercise): Slot {
  if (ex.kind === 'reps') return 'bodyweight';
  if (ex.equipment === 'barbell' || ex.equipment === 'trap bar') {
    return ISOLATION.has(ex.muscle) && ex.muscle !== 'shoulders' ? 'compound' : 'heavy';
  }
  return ISOLATION.has(ex.muscle) ? 'isolation' : 'compound';
}

/** The rep range the coach works in: the exercise's own, or the goal's default. */
export function repRange(ex: Exercise, goal: Goal = 'general'): [number, number] {
  if (ex.repMin && ex.repMax && ex.repMax >= ex.repMin) return [ex.repMin, ex.repMax];
  return RANGES[goal][slot(ex)];
}

export function incrementKg(ex: Exercise, unit: Unit): number {
  return ex.incrementKg && ex.incrementKg > 0 ? ex.incrementKg : defaultIncrementKg(ex.equipment, unit);
}

/** Round a kg value onto what can be loaded in the display unit. */
export function loadable(kg: number, unit: Unit): number {
  const step = unit === 'kg' ? 0.5 : 1;
  return fromDisplay(roundTo(toDisplay(kg, unit), step), unit);
}

/**
 * Round onto a weight this exercise can actually be loaded to: whole plate
 * jumps on a bar, the dumbbell rack's spacing for dumbbells. A suggestion of
 * 63.5 kg on a barbell is one nobody can follow. `down` is for backing off —
 * a deload or an off day should never round up.
 */
export function loadableFor(ex: Exercise, kg: number, unit: Unit, mode: 'nearest' | 'down' = 'nearest'): number {
  const step = toDisplay(incrementKg(ex, unit), unit);
  const v = toDisplay(kg, unit) / step;
  const n = mode === 'down' ? Math.floor(v + 1e-9) : Math.round(v);
  return fromDisplay(Math.round(n * step * 1000) / 1000, unit);
}

/** Sets that count for progression: completed, not warm-ups, not drop sets. */
function progressionSets(s: Session): WorkoutSet[] {
  return s.sets.filter((x) => isWorking(x) && x.type !== 'drop');
}

/** The weight most of the working sets used; ties go to the heavier. */
export function workingWeight(sets: WorkoutSet[]): number | undefined {
  const counts = new Map<number, number>();
  for (const s of sets) {
    if (s.weight === undefined) continue;
    const k = Math.round(s.weight * 1000) / 1000;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestN = 0;
  for (const [w, n] of counts) {
    if (n > bestN || (n === bestN && best !== undefined && w > best)) {
      best = w;
      bestN = n;
    }
  }
  return best;
}

const same = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && Math.abs(a - b) < 0.01;

/**
 * Sessions since the last new best at the current working weight.
 *
 * Only the trailing run of sessions at the same load counts — a change of
 * weight, up or down, starts a fresh run. Within the run, a session is
 * progress only if its total reps at that weight beat every earlier session in
 * the run, so losing a rep and then winning it back is not mistaken for moving
 * forward.
 */
export function stallCount(history: Session[]): number {
  if (history.length < 2) return 0;
  const weightOf = (s: Session) => workingWeight(progressionSets(s)) ?? 0;
  const w = weightOf(history[history.length - 1]);
  let start = history.length - 1;
  while (start > 0 && same(weightOf(history[start - 1]), w)) start--;
  const score = (s: Session) =>
    progressionSets(s)
      .filter((x) => same(x.weight ?? 0, w))
      .reduce((a, x) => a + (x.reps ?? 0) + (x.seconds ?? 0), 0);
  let best = -1;
  let sinceBest = 0;
  for (let i = start; i < history.length; i++) {
    const v = score(history[i]);
    if (v > best) {
      best = v;
      sinceBest = 0;
    } else sinceBest++;
  }
  return sinceBest;
}

export interface SuggestOptions {
  goal?: Goal;
  /** For a first session: a starting load estimated from a related lift. */
  start?: { weightKg: number; reps: number; fromName: string; fromE1rmKg: number };
}

export function suggest(ex: Exercise, history: Session[], unit: Unit, opts: SuggestOptions = {}): Suggestion {
  const range = repRange(ex, opts.goal);
  const [lo, hi] = range;
  const last = history[history.length - 1];
  const fmtW = (kg: number) => `${fmtNum(toDisplay(kg, unit), 1)} ${unit}`;

  if (!last) {
    const start = opts.start;
    if (start) {
      return {
        action: 'first',
        sets: [{ weight: start.weightKg, reps: start.reps }],
        headline: `Start around ${fmtW(start.weightKg)} × ${start.reps}`,
        detail: `Estimated from your ${start.fromName} (about ${fmtW(start.fromE1rmKg)} for one rep), with two reps in reserve. Treat the first set as a calibration and adjust; the coach takes over next session.`,
        stalled: 0,
        range,
      };
    }
    return {
      action: 'first',
      sets: [],
      headline: 'First session',
      detail: `Pick a weight you can lift for ${lo}–${hi} clean reps. The coach takes it from there.`,
      stalled: 0,
      range,
    };
  }

  const sets = progressionSets(last);

  if (ex.kind === 'time') {
    const best = Math.max(0, ...sets.map((s) => s.seconds ?? 0));
    const target = best + (best >= 60 ? 10 : 5);
    return {
      action: 'time',
      sets: sets.map((s) => ({ seconds: Math.max(s.seconds ?? 0, target), weight: s.weight })),
      headline: `Hold ${target}s`,
      detail: `Last time your longest hold was ${best}s. Add a few seconds each session.`,
      stalled: stallCount(history),
      range,
    };
  }

  if (ex.kind === 'cardio') {
    const best = sets.reduce<WorkoutSet | undefined>((a, b) => ((b.distance ?? 0) > (a?.distance ?? 0) ? b : a), undefined);
    const km = (best?.distance ?? 0) / 1000;
    return {
      action: 'cardio',
      sets: sets.map((s) => ({ distance: s.distance, seconds: s.seconds })),
      headline: km ? `Beat ${fmtNum(km, 2)} km` : 'Go a little further',
      detail: 'Cover the same distance a little faster, or go a little further at the same pace.',
      stalled: 0,
      range,
    };
  }

  const assisted = ex.kind === 'assisted';
  const w = workingWeight(sets) ?? 0;
  const atW = sets.filter((s) => same(s.weight ?? 0, w));
  const count = Math.max(1, atW.length);
  const inc = incrementKg(ex, unit);
  const stalled = stallCount(history);

  // Bodyweight with no load: progress reps; past the top of the range, add load.
  if (ex.kind === 'reps' && w === 0) {
    const allTop = atW.length > 0 && atW.every((s) => (s.reps ?? 0) >= hi);
    const targets = atW.map((s) => ({ reps: (s.reps ?? 0) + 1 }));
    return {
      action: allTop ? 'increase' : 'reps',
      sets: targets,
      headline: allTop ? 'Add load or a harder variation' : `${targets.map((t) => t.reps).join(' / ')} reps`,
      detail: allTop
        ? `Every set reached ${hi}+ reps. Add a belt or vest, or move to a harder variation.`
        : `One more rep on each set than last time.`,
      stalled,
      range,
    };
  }

  if (stalled >= 3) {
    const deload = assisted ? loadableFor(ex, w * 1.1, unit) : loadableFor(ex, w * 0.9, unit, 'down');
    return {
      action: 'deload',
      sets: Array.from({ length: count }, () => ({ weight: deload, reps: hi })),
      headline: `Deload to ${fmtW(deload)}`,
      detail: `${stalled} sessions without adding weight or reps at ${fmtW(w)}. Drop 10%, work back up to ${hi} reps, and you will usually pass the old best within a few weeks.`,
      stalled,
      range,
    };
  }

  const allTop = atW.length > 0 && atW.every((s) => (s.reps ?? 0) >= hi);
  if (allTop) {
    const next = loadable(assisted ? Math.max(0, w - inc) : w + inc, unit);
    return {
      action: 'increase',
      sets: Array.from({ length: count }, () => ({ weight: next, reps: lo })),
      headline: assisted ? `Less assistance: ${fmtW(next)}` : `Go up to ${fmtW(next)}`,
      detail: `Every working set hit ${hi} reps at ${fmtW(w)}. Add ${fmtW(inc)} and aim for ${lo}+ reps.`,
      stalled: 0,
      range,
    };
  }

  // Same weight, one more rep on every set that is still short of the top.
  const targets = atW.map((s) => ({ weight: w, reps: Math.min(hi, Math.max(lo, (s.reps ?? 0) + 1)) }));
  const missedBottom = atW.some((s) => (s.reps ?? 0) < lo);
  return {
    action: stalled >= 2 ? 'hold' : 'reps',
    sets: targets,
    headline: `${fmtW(w)} × ${targets.map((t) => t.reps).join(' / ')}`,
    detail:
      stalled >= 2
        ? `${stalled} sessions without progress here. Sleep, food and rest times are the usual culprits — one more stalled session and the coach will deload you.`
        : missedBottom
          ? `Some sets fell below ${lo} reps. Stay at ${fmtW(w)} until every set reaches ${hi}.`
          : `Add a rep where you can. When every set reaches ${hi}, the weight goes up.`,
    stalled,
    range,
  };
}
