// The coach's judgement beyond "add a rep": how today compares with your usual,
// why a lift has stalled and what to change, and where to start on a lift you
// have never done.
//
// Pure functions over the same Session history the rest of the core uses.

import { e1rm, isWorking, weightForReps, type Session } from './analytics.ts';
import { loadableFor, repRange, stallCount, type Goal } from './coach.ts';
import type { Exercise, Unit, WorkoutSet } from './types.ts';
import { fmtNum, toDisplay } from './units.ts';

// ---------------------------------------------------------------------------
// Readiness: is today a strong day or an off day?

export interface Readiness {
  kind: 'low' | 'high';
  /** Today's best estimated 1RM over the recent baseline. */
  ratio: number;
  /** Suggested load for the sets still to come, kg. */
  weightKg: number;
  headline: string;
  detail: string;
}

/** Mean of the best e1RM in each of the last `n` sessions. */
export function baselineE1rm(history: Session[], n = 3): number | undefined {
  const recent = history.slice(-n).map((s) => s.bestE1rm).filter((v): v is number => v !== undefined && v > 0);
  if (recent.length < 2) return undefined;
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/**
 * Compare the working sets done so far today with the lifter's recent baseline.
 * Two percent either way is noise; past 8% down the remaining sets should come
 * down to match, and past 4% up there is room to push. Returns null when there
 * is nothing worth saying, or no sets left to act on.
 */
export function readiness(
  ex: Exercise,
  history: Session[],
  today: WorkoutSet[],
  unit: Unit,
  goal: Goal = 'general',
): Readiness | null {
  if (ex.kind !== 'weight') return null;
  const base = baselineE1rm(history);
  if (!base) return null;
  const done = today.filter((s) => isWorking(s) && s.type !== 'drop' && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
  const remaining = today.filter((s) => !s.done && s.type !== 'warmup');
  if (!done.length || !remaining.length) return null;
  const best = Math.max(...done.map((s) => e1rm(s.weight!, s.reps!, s.rpe) ?? 0));
  if (!(best > 0)) return null;
  const ratio = best / base;
  const [lo, hi] = repRange(ex, goal);
  const reps = Math.round((lo + hi) / 2);
  const w = (kg: number) => `${fmtNum(toDisplay(kg, unit), 1)} ${unit}`;
  const pct = Math.round(Math.abs(ratio - 1) * 100);
  if (ratio < 0.92) {
    // Sized to today's strength, with a rep in reserve.
    const kg = loadableFor(ex, weightForReps(best, reps + 1), unit, 'down');
    return {
      kind: 'low',
      ratio,
      weightKg: kg,
      headline: `Off day, ${pct}% under your usual`,
      detail: `Sleep, food and stress all show up here. Drop to ${w(kg)} for the sets you have left and keep the reps clean; a bad day handled well is still progress.`,
    };
  }
  if (ratio > 1.04) {
    const kg = loadableFor(ex, weightForReps(best, reps), unit);
    const current = Math.max(...done.map((s) => s.weight ?? 0));
    if (kg <= current) return null;
    return {
      kind: 'high',
      ratio,
      weightKg: kg,
      headline: `Strong day, ${pct}% over your usual`,
      detail: `You have more in the tank than usual. Try ${w(kg)} for ${reps} on the next set.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plateau diagnosis

export interface Prescription {
  title: string;
  detail: string;
}

export interface DiagnosisContext {
  /** Average hard sets per week for this exercise's main muscle, last 4 weeks. */
  weeklyMuscleSets: number;
  /** Your weekly target from settings. */
  weeklyTarget: number;
  /** Sessions of this exercise per week, last 6 weeks. */
  sessionsPerWeek: number;
  /** Other exercises for the same muscle, best candidates first. */
  alternatives: Exercise[];
  goal?: Goal;
}

/**
 * Why a lift has stopped moving, from the training log rather than a generic
 * list: too little weekly volume for the muscle, or too much; too rarely
 * trained; too few working sets; a rep range that has run its course. Ends
 * with a variation to rotate to. Empty unless the lift has stalled for two or
 * more sessions.
 */
export function diagnose(ex: Exercise, history: Session[], ctx: DiagnosisContext): Prescription[] {
  if (ex.kind === 'time' || ex.kind === 'cardio') return [];
  const stalled = stallCount(history);
  if (stalled < 2) return [];
  const out: Prescription[] = [];
  const muscle = ex.muscle;
  const sets = Math.round(ctx.weeklyMuscleSets * 10) / 10;

  if (ctx.sessionsPerWeek > 0 && ctx.sessionsPerWeek < 1) {
    const days = Math.round(7 / ctx.sessionsPerWeek);
    out.push({
      title: 'Train it twice a week',
      detail: `You have done this about once every ${days} days lately. Splitting the same sets across two sessions a week is the most reliable way through a stall.`,
    });
  }
  if (ctx.weeklyMuscleSets < ctx.weeklyTarget * 0.8) {
    out.push({
      title: `Give your ${muscle} more work`,
      detail: `Your ${muscle} has averaged ${fmtNum(sets, 1)} hard sets a week, under your target of ${ctx.weeklyTarget}. Add a set here or one more exercise for ${muscle}.`,
    });
  } else if (ctx.weeklyMuscleSets > Math.max(20, ctx.weeklyTarget * 2)) {
    out.push({
      title: 'Do a little less',
      detail: `${fmtNum(sets, 1)} hard sets a week for ${muscle} is a lot to recover from. Cutting one set from each session often restarts progress.`,
    });
  }
  const last = history[history.length - 1];
  const working = last ? last.sets.filter((s) => isWorking(s) && s.type !== 'drop').length : 0;
  if (working > 0 && working <= 2) {
    out.push({
      title: 'Add a working set',
      detail: `Your last session had ${working} working set${working > 1 ? 's' : ''}. A third set at the same weight adds volume without needing more strength yet.`,
    });
  }
  const [lo, hi] = repRange(ex, ctx.goal);
  if (ex.kind === 'weight') {
    if (hi <= 6) {
      out.push({ title: 'Switch to 6–10 reps for a block', detail: 'Heavy triples and fives have stopped paying. Three or four weeks of 6–10 builds the base the next heavy block runs on.' });
    } else if (lo >= 8) {
      out.push({ title: 'Try a heavier 4–6 block', detail: 'Lighter sets have stopped moving the number. Three weeks of 4–6 reps often unlocks the higher-rep work too.' });
    }
  }
  const alt = ctx.alternatives.find((a) => a.id !== ex.id);
  if (alt) {
    out.push({
      title: `Rotate to ${alt.name}`,
      detail: `Swap for 4–6 weeks, then come back. A close variation keeps the ${muscle} growing while the movement you are stuck on gets a rest.`,
    });
  }
  return out;
}

/** The movement a name describes: presses swap for presses, rows for rows. */
const PATTERNS = ['press', 'row', 'squat', 'deadlift', 'curl', 'raise', 'fly', 'pulldown', 'pull up', 'chin up', 'extension', 'lunge', 'pushdown', 'thrust', 'dip', 'crunch', 'shrug', 'kickback', 'split squat', 'leg curl'];

function pattern(name: string): string | undefined {
  const n = name.toLowerCase();
  // Longest match first, so "split squat" beats "squat".
  return [...PATTERNS].sort((a, b) => b.length - a.length).find((p) => n.includes(p));
}

/**
 * Swaps for a stalled lift, closest first: the same movement family (a
 * dumbbell press for a barbell press), then the same movement pattern for the
 * same muscle, weighted by shared helper muscles and by what the lifter
 * already knows. Never a different movement that merely shares a muscle —
 * face pulls are no substitute for an overhead press.
 */
export function alternativesFor(ex: Exercise, all: Iterable<Exercise>, used: Set<string>): Exercise[] {
  const fam = FAMILY_OF.get(ex.id);
  const pat = pattern(ex.name);
  const scored: { e: Exercise; score: number }[] = [];
  for (const e of all) {
    if (e.id === ex.id || e.archived || e.kind !== ex.kind || e.muscle !== ex.muscle) continue;
    const sameFamily = !!fam && FAMILY_OF.get(e.id) === fam;
    const samePattern = !!pat && pattern(e.name) === pat;
    if (!sameFamily && !samePattern) continue;
    const shared = e.secondary.filter((m) => ex.secondary.includes(m)).length;
    const score = (sameFamily ? 6 : 0) + (samePattern ? 3 : 0) + shared * 2 + (used.has(e.id) ? 1 : 0);
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name)).slice(0, 5).map((x) => x.e);
}

// ---------------------------------------------------------------------------
// Starting weights for a lift you have never done

/**
 * Typical one-rep-max ratios within a movement family, relative to its anchor
 * lift. Dumbbell figures are per dumbbell. Rough by nature — they are a place
 * to start, labelled as such, and the coach takes over after one session.
 * Machines are left out: stacks differ too much between gyms to guess.
 */
const FAMILIES: Record<string, Record<string, number>> = {
  'bench-press-barbell': {
    'bench-press-barbell': 1,
    'incline-bench-press-barbell': 0.82,
    'decline-bench-press-barbell': 0.95,
    'close-grip-bench-press-barbell': 0.88,
    'floor-press-barbell': 0.9,
    'bench-press-smith-machine': 0.95,
    'bench-press-dumbbell': 0.4,
    'incline-bench-press-dumbbell': 0.34,
    'floor-press-dumbbell': 0.37,
    'chest-fly-dumbbell': 0.15,
    'skullcrusher-ez-bar': 0.32,
  },
  'squat-barbell': {
    'squat-barbell': 1,
    'front-squat-barbell': 0.82,
    'high-bar-squat-barbell': 0.95,
    'low-bar-squat-barbell': 1.03,
    'box-squat-barbell': 0.9,
    'pause-squat-barbell': 0.85,
    'squat-smith-machine': 0.95,
    'goblet-squat-dumbbell': 0.33,
    'bulgarian-split-squat-dumbbell': 0.2,
    'bulgarian-split-squat-barbell': 0.45,
    'lunge-dumbbell': 0.22,
    'lunge-barbell': 0.5,
  },
  'deadlift-barbell': {
    'deadlift-barbell': 1,
    'deadlift-trap-bar': 1.05,
    'sumo-deadlift-barbell': 0.97,
    'romanian-deadlift-barbell': 0.7,
    'stiff-leg-deadlift-barbell': 0.65,
    'romanian-deadlift-dumbbell': 0.3,
    'rack-pull-barbell': 1.15,
    'hip-thrust-barbell': 0.9,
    'good-morning-barbell': 0.4,
    'shrug-barbell': 0.8,
    'bent-over-row-barbell': 0.52,
    'pendlay-row-barbell': 0.48,
  },
  'overhead-press-barbell': {
    'overhead-press-barbell': 1,
    'seated-overhead-press-barbell': 0.95,
    'push-press-barbell': 1.25,
    'overhead-press-dumbbell': 0.38,
    'seated-overhead-press-dumbbell': 0.36,
    'arnold-press-dumbbell': 0.33,
    'lateral-raise-dumbbell': 0.14,
    'front-raise-dumbbell': 0.16,
  },
  'bicep-curl-barbell': {
    'bicep-curl-barbell': 1,
    'bicep-curl-ez-bar': 1,
    'preacher-curl-ez-bar': 0.85,
    'bicep-curl-dumbbell': 0.45,
    'hammer-curl-dumbbell': 0.5,
    'incline-curl-dumbbell': 0.38,
    'concentration-curl-dumbbell': 0.38,
  },
};

const FAMILY_OF = new Map<string, string>();
for (const [anchor, members] of Object.entries(FAMILIES)) for (const id of Object.keys(members)) FAMILY_OF.set(id, anchor);

export interface StartEstimate {
  weightKg: number;
  reps: number;
  fromId: string;
  fromE1rmKg: number;
}

/**
 * Where to start on `ex`, from the lifter's recent strength on another lift
 * in the same movement family. Aims for the bottom of the rep range with a
 * couple of reps in reserve, so the first session is a calibration, not a test.
 */
export function startingEstimate(
  ex: Exercise,
  histories: Map<string, Session[]>,
  unit: Unit,
  goal: Goal = 'general',
): StartEstimate | undefined {
  const family = FAMILY_OF.get(ex.id);
  if (!family || ex.kind !== 'weight') return undefined;
  const members = FAMILIES[family];
  let best: { id: string; anchor1rm: number; e1rm: number } | undefined;
  for (const [id, ratio] of Object.entries(members)) {
    if (id === ex.id) continue;
    const h = histories.get(id);
    const base = h ? baselineE1rm(h, 4) ?? h[h.length - 1]?.bestE1rm : undefined;
    if (!base) continue;
    // Prefer the anchor itself, then the closest relative.
    const anchor1rm = base / ratio;
    if (!best || id === family || (best.id !== family && Math.abs(Math.log(ratio)) < Math.abs(Math.log(members[best.id])))) {
      best = { id, anchor1rm, e1rm: base };
    }
  }
  if (!best) return undefined;
  const target1rm = best.anchor1rm * members[ex.id];
  const [lo] = repRange(ex, goal);
  // Two reps in reserve at the bottom of the range.
  const weightKg = loadableFor(ex, weightForReps(target1rm, lo + 2), unit, 'down');
  if (!(weightKg > 0)) return undefined;
  return { weightKg, reps: lo, fromId: best.id, fromE1rmKg: best.e1rm };
}
