// The coach as screens use it: one place that turns the log into a
// suggestion, a starting estimate and a plateau diagnosis, so the Today board,
// the exercise page and the workout screen always agree.

import { useMemo } from 'react';
import { allHistories, muscleSets, type Session } from '../core/analytics.ts';
import { suggest, type Goal, type Suggestion } from '../core/coach.ts';
import { alternativesFor, diagnose, startingEstimate, type Prescription } from '../core/insight.ts';
import type { Exercise, Settings, Unit, Workout } from '../core/types.ts';
import { useStore } from '../state/store.ts';

const DAY = 86400000;

export function useHistories(): Map<string, Session[]> {
  const workouts = useStore((s) => s.db.workouts);
  const rpeAdjust = useStore((s) => s.db.settings.rpeAdjust);
  return useMemo(() => allHistories(workouts, rpeAdjust), [workouts, rpeAdjust]);
}

/** "Bench Press (Barbell)" → "bench press", for use mid-sentence. */
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').toLowerCase();
}

export function coachFor(
  ex: Exercise,
  histories: Map<string, Session[]>,
  exercises: Map<string, Exercise>,
  unit: Unit,
  goal: Goal,
): Suggestion {
  const history = histories.get(ex.id) ?? [];
  const est = history.length ? undefined : startingEstimate(ex, histories, unit, goal);
  const from = est ? exercises.get(est.fromId) : undefined;
  return suggest(ex, history, unit, { goal, start: est && from ? { ...est, fromName: shortName(from.name) } : undefined });
}

export function diagnosisFor(
  ex: Exercise,
  histories: Map<string, Session[]>,
  workouts: Workout[],
  exercises: Map<string, Exercise>,
  settings: Settings,
  now = Date.now(),
): Prescription[] {
  const history = histories.get(ex.id) ?? [];
  const weekly = (muscleSets(workouts, exercises, now - 28 * DAY, now).get(ex.muscle) ?? 0) / 4;
  const recent = history.filter((s) => s.date >= now - 42 * DAY).length / 6;
  return diagnose(ex, history, {
    weeklyMuscleSets: weekly,
    weeklyTarget: settings.weeklySetTarget,
    sessionsPerWeek: recent,
    alternatives: alternativesFor(ex, exercises.values(), new Set(histories.keys())),
    goal: settings.goal,
  });
}
