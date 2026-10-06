// Strength analytics: estimated one-rep max, per-exercise history, personal
// records, and the numbers behind every chart.
//
// Pure functions over the database. Nothing here knows about React.

import type { Exercise, Workout, WorkoutSet } from './types.ts';

/**
 * Estimated 1RM by Epley's formula. Above 20 reps a set says more about
 * endurance than strength, so the estimate is withheld.
 *
 * With `rpe`, reps in reserve (10 - RPE) are counted as reps the lifter could
 * have done, which is what makes an RPE 7 triple and an RPE 10 triple differ.
 */
export function e1rm(weight: number, reps: number, rpe?: number): number | undefined {
  if (!(weight > 0) || !(reps > 0)) return undefined;
  const rir = rpe !== undefined && rpe >= 5 && rpe <= 10 ? 10 - rpe : 0;
  const r = reps + rir;
  if (r > 20) return undefined;
  if (r === 1) return weight;
  return weight * (1 + r / 30);
}

/** Weight you could lift for `reps`, given a 1RM — the inverse of e1rm. */
export function weightForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + reps / 30);
}

export function isWorking(s: WorkoutSet): boolean {
  return s.done && s.type !== 'warmup';
}

/** One appearance of an exercise in one workout. */
export interface Session {
  workoutId: string;
  date: number;
  sets: WorkoutSet[];
  /** Working sets only. */
  working: WorkoutSet[];
  bestE1rm?: number;
  topWeight?: number;
  volume: number;
  totalReps: number;
  bestSet?: WorkoutSet;
  maxSeconds?: number;
  maxDistance?: number;
}

export function sessionStats(workoutId: string, date: number, sets: WorkoutSet[], rpeAdjust = true): Session {
  const working = sets.filter(isWorking);
  let bestE1rm: number | undefined;
  let bestSet: WorkoutSet | undefined;
  let topWeight: number | undefined;
  let volume = 0;
  let totalReps = 0;
  let maxSeconds: number | undefined;
  let maxDistance: number | undefined;
  for (const s of working) {
    const w = s.weight ?? 0;
    const r = s.reps ?? 0;
    volume += w * r;
    totalReps += r;
    if (w > 0 && (topWeight === undefined || w > topWeight)) topWeight = w;
    const est = e1rm(w, r, rpeAdjust ? s.rpe : undefined);
    if (est !== undefined && (bestE1rm === undefined || est > bestE1rm)) {
      bestE1rm = est;
      bestSet = s;
    }
    if (s.seconds && (maxSeconds === undefined || s.seconds > maxSeconds)) maxSeconds = s.seconds;
    if (s.distance && (maxDistance === undefined || s.distance > maxDistance)) maxDistance = s.distance;
  }
  if (!bestSet && working.length) {
    bestSet = working.reduce((a, b) => ((b.reps ?? 0) > (a.reps ?? 0) ? b : a));
  }
  return { workoutId, date, sets, working, bestE1rm, topWeight, volume, totalReps, bestSet, maxSeconds, maxDistance };
}

/** Every session of one exercise, oldest first, finished workouts only. */
export function exerciseHistory(workouts: Workout[], exerciseId: string, rpeAdjust = true): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    if (!w.end) continue;
    const sets: WorkoutSet[] = [];
    for (const we of w.exercises) if (we.exerciseId === exerciseId) sets.push(...we.sets);
    if (sets.some((s) => s.done)) out.push(sessionStats(w.id, w.start, sets, rpeAdjust));
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Every exercise's history in one pass over the log, keyed by exercise id. */
export function allHistories(workouts: Workout[], rpeAdjust = true): Map<string, Session[]> {
  const sets = new Map<string, { w: Workout; sets: WorkoutSet[] }[]>();
  for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
    if (!w.end) continue;
    const byEx = new Map<string, WorkoutSet[]>();
    for (const we of w.exercises) byEx.set(we.exerciseId, [...(byEx.get(we.exerciseId) ?? []), ...we.sets]);
    for (const [id, list] of byEx) {
      if (!list.some((s) => s.done)) continue;
      const cur = sets.get(id) ?? [];
      cur.push({ w, sets: list });
      sets.set(id, cur);
    }
  }
  const out = new Map<string, Session[]>();
  for (const [id, list] of sets) out.set(id, list.map(({ w, sets }) => sessionStats(w.id, w.start, sets, rpeAdjust)));
  return out;
}

export interface Records {
  bestE1rm?: { value: number; date: number; set: WorkoutSet };
  heaviest?: { value: number; date: number; reps: number };
  bestSetVolume?: { value: number; date: number; set: WorkoutSet };
  bestSessionVolume?: { value: number; date: number };
  mostReps?: { value: number; date: number; weight: number };
  longest?: { value: number; date: number };
  farthest?: { value: number; date: number };
  /** Heaviest weight lifted for each rep count 1..15. */
  repMaxes: { reps: number; weight: number; date: number }[];
}

export function records(history: Session[]): Records {
  const rec: Records = { repMaxes: [] };
  const byReps = new Map<number, { weight: number; date: number }>();
  for (const s of history) {
    if (s.bestE1rm !== undefined && s.bestSet && (!rec.bestE1rm || s.bestE1rm > rec.bestE1rm.value)) {
      rec.bestE1rm = { value: s.bestE1rm, date: s.date, set: s.bestSet };
    }
    if (s.volume > 0 && (!rec.bestSessionVolume || s.volume > rec.bestSessionVolume.value)) {
      rec.bestSessionVolume = { value: s.volume, date: s.date };
    }
    if (s.maxSeconds && (!rec.longest || s.maxSeconds > rec.longest.value)) rec.longest = { value: s.maxSeconds, date: s.date };
    if (s.maxDistance && (!rec.farthest || s.maxDistance > rec.farthest.value)) rec.farthest = { value: s.maxDistance, date: s.date };
    for (const set of s.working) {
      const w = set.weight ?? 0;
      const r = set.reps ?? 0;
      if (w > 0 && (!rec.heaviest || w > rec.heaviest.value || (w === rec.heaviest.value && r > rec.heaviest.reps))) {
        rec.heaviest = { value: w, date: s.date, reps: r };
      }
      if (w * r > 0 && (!rec.bestSetVolume || w * r > rec.bestSetVolume.value)) {
        rec.bestSetVolume = { value: w * r, date: s.date, set };
      }
      if (r > 0 && (!rec.mostReps || r > rec.mostReps.value || (r === rec.mostReps.value && w > rec.mostReps.weight))) {
        rec.mostReps = { value: r, date: s.date, weight: w };
      }
      if (w > 0 && r >= 1 && r <= 15) {
        const cur = byReps.get(r);
        if (!cur || w > cur.weight) byReps.set(r, { weight: w, date: s.date });
      }
    }
  }
  // A rep max only counts if nothing heavier was lifted for more reps: 100x5
  // makes a 95x3 meaningless as a "3 rep max".
  const sorted = [...byReps.entries()].sort((a, b) => a[0] - b[0]);
  for (const [reps, v] of sorted) {
    const dominated = sorted.some(([r2, v2]) => r2 > reps && v2.weight >= v.weight);
    if (!dominated) rec.repMaxes.push({ reps, ...v });
  }
  return rec;
}

export type PrKind = 'e1rm' | 'weight' | 'volume' | 'reps' | 'repmax' | 'time' | 'distance';

export interface PrHit {
  exerciseId: string;
  kind: PrKind;
  value: number;
  previous?: number;
  /** For rep maxes: the rep count. */
  reps?: number;
  setId?: string;
}

/**
 * Which records a workout broke, compared with everything finished before it.
 * A first-ever session sets no records: beating nothing is not news.
 */
export function workoutPrs(workout: Workout, workouts: Workout[], rpeAdjust = true): PrHit[] {
  const before = workouts.filter((w) => w.end && w.start < workout.start && w.id !== workout.id);
  const hits: PrHit[] = [];
  const seen = new Set<string>();
  for (const we of workout.exercises) {
    if (seen.has(we.exerciseId)) continue;
    seen.add(we.exerciseId);
    const prior = exerciseHistory(before, we.exerciseId, rpeAdjust);
    if (!prior.length) continue;
    const old = records(prior);
    const sets = workout.exercises.filter((x) => x.exerciseId === we.exerciseId).flatMap((x) => x.sets);
    const now = sessionStats(workout.id, workout.start, sets, rpeAdjust);
    const id = we.exerciseId;
    if (now.bestE1rm !== undefined && old.bestE1rm && now.bestE1rm > old.bestE1rm.value + 1e-6) {
      hits.push({ exerciseId: id, kind: 'e1rm', value: now.bestE1rm, previous: old.bestE1rm.value, setId: now.bestSet?.id });
    }
    if (now.topWeight !== undefined && old.heaviest && now.topWeight > old.heaviest.value + 1e-6) {
      hits.push({ exerciseId: id, kind: 'weight', value: now.topWeight, previous: old.heaviest.value });
    }
    if (now.volume > 0 && old.bestSessionVolume && now.volume > old.bestSessionVolume.value + 1e-6) {
      hits.push({ exerciseId: id, kind: 'volume', value: now.volume, previous: old.bestSessionVolume.value });
    }
    if (now.maxSeconds && old.longest && now.maxSeconds > old.longest.value) {
      hits.push({ exerciseId: id, kind: 'time', value: now.maxSeconds, previous: old.longest.value });
    }
    if (now.maxDistance && old.farthest && now.maxDistance > old.farthest.value) {
      hits.push({ exerciseId: id, kind: 'distance', value: now.maxDistance, previous: old.farthest.value });
    }
    // Reps-only movements: more reps in a set than ever before.
    if (now.topWeight === undefined && old.mostReps && !old.heaviest) {
      const best = Math.max(0, ...now.working.map((s) => s.reps ?? 0));
      if (best > old.mostReps.value) hits.push({ exerciseId: id, kind: 'reps', value: best, previous: old.mostReps.value });
    }
    // Rep maxes: heavier than ever before at this rep count, and not already
    // reported as an outright heaviest-weight record.
    const newRm = new Map<number, number>();
    for (const s of now.working) {
      const r = s.reps ?? 0;
      const w = s.weight ?? 0;
      if (r < 2 || r > 15 || w <= 0) continue;
      const priorBest = Math.max(0, ...prior.flatMap((p) => p.working).filter((x) => (x.reps ?? 0) >= r).map((x) => x.weight ?? 0));
      if (w > priorBest + 1e-6 && w > (newRm.get(r) ?? 0)) newRm.set(r, w);
    }
    const reportedWeight = hits.some((h) => h.exerciseId === id && h.kind === 'weight');
    for (const [reps, w] of newRm) {
      if (reportedWeight && w === now.topWeight) continue;
      hits.push({ exerciseId: id, kind: 'repmax', value: w, reps });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Training load across the whole log

export function workoutVolume(w: Workout): number {
  let v = 0;
  for (const we of w.exercises) for (const s of we.sets) if (isWorking(s)) v += (s.weight ?? 0) * (s.reps ?? 0);
  return v;
}

export function workoutSetCount(w: Workout): number {
  let n = 0;
  for (const we of w.exercises) for (const s of we.sets) if (isWorking(s)) n++;
  return n;
}

/** Start of the week containing `at`, local time. */
export function weekStart(at: number, startDay: 0 | 1 = 1): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function dayStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Hard sets per muscle over a window. A set counts fully toward the primary
 * muscle and half toward each secondary — the usual convention in the volume
 * research this target is borrowed from.
 */
export function muscleSets(
  workouts: Workout[],
  exercises: Map<string, Exercise>,
  from: number,
  to: number,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of workouts) {
    if (!w.end || w.start < from || w.start >= to) continue;
    for (const we of w.exercises) {
      const ex = exercises.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter(isWorking).length;
      if (!n) continue;
      out.set(ex.muscle, (out.get(ex.muscle) ?? 0) + n);
      for (const m of ex.secondary) out.set(m, (out.get(m) ?? 0) + n / 2);
    }
  }
  return out;
}

export interface WeekBucket {
  start: number;
  workouts: number;
  volume: number;
  sets: number;
  seconds: number;
}

/** The last `count` weeks, oldest first, including empty ones. */
export function weeklyBuckets(workouts: Workout[], count: number, startDay: 0 | 1, now = Date.now()): WeekBucket[] {
  const thisWeek = weekStart(now, startDay);
  const buckets: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - i * 7);
    buckets.push({ start: d.getTime(), workouts: 0, volume: 0, sets: 0, seconds: 0 });
  }
  const first = buckets[0].start;
  for (const w of workouts) {
    if (!w.end || w.start < first) continue;
    const ws = weekStart(w.start, startDay);
    const b = buckets.find((x) => x.start === ws);
    if (!b) continue;
    b.workouts++;
    b.volume += workoutVolume(w);
    b.sets += workoutSetCount(w);
    b.seconds += Math.max(0, (w.end - w.start) / 1000);
  }
  return buckets;
}

/** Consecutive weeks, ending this week or last, with at least one workout. */
export function weekStreak(workouts: Workout[], startDay: 0 | 1, now = Date.now()): number {
  const weeks = new Set(workouts.filter((w) => w.end).map((w) => weekStart(w.start, startDay)));
  let cursor = weekStart(now, startDay);
  // This week does not break the streak just because it has not happened yet.
  if (!weeks.has(cursor)) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - 7);
    cursor = d.getTime();
  }
  let n = 0;
  while (weeks.has(cursor)) {
    n++;
    const d = new Date(cursor);
    d.setDate(d.getDate() - 7);
    cursor = d.getTime();
  }
  return n;
}

/** Linear regression slope of e1RM per 30 days over recent sessions. */
export function trendPerMonth(points: { date: number; value: number }[]): number | undefined {
  if (points.length < 3) return undefined;
  const xs = points.map((p) => p.date / 86400000);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return undefined;
  return (num / den) * 30;
}
