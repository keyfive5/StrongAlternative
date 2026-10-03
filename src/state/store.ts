// App state: the database, the workout in progress, and the rest timer.
//
// One small observable store rather than a state library. Components read it
// through `useStore(selector)`; every mutation replaces the objects it touches
// so selectors see new references, then schedules a save.

import { useSyncExternalStore, useRef } from 'react';
import { LIBRARY } from '../core/library.ts';
import {
  DEFAULT_SETTINGS,
  LB_PLATES,
  uid,
  type Database,
  type Exercise,
  type Measurement,
  type Routine,
  type RoutineExercise,
  type Settings,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../core/types.ts';
import { storage } from '../platform/storage.ts';

export interface RestTimer {
  endsAt: number;
  total: number;
  exerciseName: string;
}

export interface State {
  ready: boolean;
  db: Database;
  /** Library merged with the user's custom exercises and edits, by id. */
  exercises: Map<string, Exercise>;
  active: Workout | null;
  rest: RestTimer | null;
}

function emptyDb(): Database {
  return { version: 1, exercises: [], workouts: [], routines: [], measurements: [], settings: { ...DEFAULT_SETTINGS } };
}

function mergeExercises(custom: Exercise[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const e of LIBRARY) map.set(e.id, e);
  // A stored entry with a library id is the user's edit of that exercise.
  for (const e of custom) map.set(e.id, { ...map.get(e.id), ...e });
  return map;
}

let state: State = {
  ready: false,
  db: emptyDb(),
  exercises: mergeExercises([]),
  active: null,
  rest: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

export function getState(): State {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Subscribe to a slice. Re-renders only when the selected value changes. */
export function useStore<T>(selector: (s: State) => T): T {
  const sel = useRef(selector);
  sel.current = selector;
  return useSyncExternalStore(subscribe, () => sel.current(state), () => sel.current(state));
}

// ---------------------------------------------------------------------------
// Persistence

let dbTimer: ReturnType<typeof setTimeout> | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;

function saveDb() {
  if (dbTimer) clearTimeout(dbTimer);
  dbTimer = setTimeout(() => {
    dbTimer = null;
    void storage().write('db', JSON.stringify(state.db));
  }, 250);
}

function saveActive() {
  if (activeTimer) clearTimeout(activeTimer);
  activeTimer = setTimeout(() => {
    activeTimer = null;
    if (state.active) void storage().write('active', JSON.stringify({ active: state.active, rest: state.rest }));
    else void storage().remove('active');
  }, 150);
}

/** Write anything pending right now (the app is going to the background). */
export function flush() {
  if (dbTimer) {
    clearTimeout(dbTimer);
    dbTimer = null;
    void storage().write('db', JSON.stringify(state.db));
  }
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
    if (state.active) void storage().write('active', JSON.stringify({ active: state.active, rest: state.rest }));
    else void storage().remove('active');
  }
}

export async function load() {
  let db = emptyDb();
  try {
    const raw = await storage().read('db');
    if (raw) db = migrate(JSON.parse(raw));
  } catch {}
  let active: Workout | null = null;
  let rest: RestTimer | null = null;
  try {
    const raw = await storage().read('active');
    if (raw) {
      const parsed = JSON.parse(raw);
      active = parsed.active ?? null;
      rest = parsed.rest && parsed.rest.endsAt > Date.now() ? parsed.rest : null;
    }
  } catch {}
  set({ ready: true, db, exercises: mergeExercises(db.exercises), active, rest });
}

function migrate(raw: Partial<Database>): Database {
  const base = emptyDb();
  return {
    version: 1,
    exercises: raw.exercises ?? [],
    workouts: raw.workouts ?? [],
    routines: raw.routines ?? [],
    measurements: raw.measurements ?? [],
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  };
}

function updateDb(patch: Partial<Database>) {
  const db = { ...state.db, ...patch };
  const next: Partial<State> = { db };
  if (patch.exercises) next.exercises = mergeExercises(db.exercises);
  set(next);
  saveDb();
}

// ---------------------------------------------------------------------------
// Settings

export function updateSettings(patch: Partial<Settings>) {
  let settings = { ...state.db.settings, ...patch };
  // Switching units swaps in that unit's standard plates and bar.
  if (patch.unit && patch.unit !== state.db.settings.unit) {
    settings = {
      ...settings,
      plates: patch.unit === 'lb' ? LB_PLATES.map((p) => ({ ...p })) : DEFAULT_SETTINGS.plates.map((p) => ({ ...p })),
      barKg: patch.unit === 'lb' ? 45 / 2.2046226218 : 20,
    };
  }
  updateDb({ settings });
}

// ---------------------------------------------------------------------------
// Exercises

export function saveExercise(ex: Exercise) {
  const list = state.db.exercises.filter((e) => e.id !== ex.id);
  list.push(ex);
  updateDb({ exercises: list });
}

export function createExercise(fields: Omit<Exercise, 'id' | 'custom'>): Exercise {
  const ex: Exercise = { ...fields, id: 'c-' + uid(), custom: true };
  saveExercise(ex);
  return ex;
}

export function deleteExercise(id: string) {
  const used = state.db.workouts.some((w) => w.exercises.some((e) => e.exerciseId === id));
  if (used) {
    // History refers to it; hide it from pickers instead.
    const ex = state.exercises.get(id);
    if (ex) saveExercise({ ...ex, archived: true });
    return;
  }
  updateDb({ exercises: state.db.exercises.filter((e) => e.id !== id) });
}

// ---------------------------------------------------------------------------
// Routines

export function saveRoutine(r: Routine) {
  const routines = state.db.routines.filter((x) => x.id !== r.id);
  routines.push({ ...r, updated: Date.now() });
  updateDb({ routines });
}

export function deleteRoutine(id: string) {
  updateDb({ routines: state.db.routines.filter((r) => r.id !== id) });
}

export function duplicateRoutine(id: string) {
  const r = state.db.routines.find((x) => x.id === id);
  if (r) saveRoutine({ ...r, id: uid(), name: r.name + ' copy' });
}

export function routineFromWorkout(w: Workout): Routine {
  return {
    id: uid(),
    name: w.name,
    updated: Date.now(),
    exercises: w.exercises.map((we) => ({
      exerciseId: we.exerciseId,
      restSec: we.restSec,
      superset: we.superset,
      notes: we.notes,
      sets: we.sets
        .filter((s) => s.done)
        .map((s) => ({ type: s.type, weight: s.weight, reps: s.reps, seconds: s.seconds, distance: s.distance })),
    })),
  };
}

/**
 * A routine updated from a workout done from it. Exercises skipped today are
 * kept (skipping one is not deleting it), performed ones take today's set
 * count, and exercises added today are appended. Returns null when nothing
 * would change.
 */
export function mergeRoutine(r: Routine, w: Workout): Routine | null {
  const today = routineFromWorkout(w).exercises;
  const used = new Set<number>();
  const merged: RoutineExercise[] = r.exercises.map((re) => {
    const i = today.findIndex((t, j) => !used.has(j) && t.exerciseId === re.exerciseId);
    if (i === -1) return re;
    used.add(i);
    return { ...re, sets: today[i].sets.map((s) => ({ type: s.type })), superset: today[i].superset ?? re.superset };
  });
  today.forEach((t, j) => {
    if (!used.has(j)) merged.push({ ...t, sets: t.sets.map((s) => ({ type: s.type })) });
  });
  const shape = (xs: RoutineExercise[]) => JSON.stringify(xs.map((x) => [x.exerciseId, x.sets.map((s) => s.type)]));
  return shape(merged) === shape(r.exercises) ? null : { ...r, exercises: merged };
}

// ---------------------------------------------------------------------------
// The workout in progress

export function newSet(type: WorkoutSet['type'] = 'normal'): WorkoutSet {
  return { id: uid(), type, done: false };
}

function setActive(active: Workout | null) {
  set({ active });
  saveActive();
}

function defaultName(at: number): string {
  const h = new Date(at).getHours();
  if (h < 5) return 'Night Workout';
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  if (h < 21) return 'Evening Workout';
  return 'Night Workout';
}

export function startWorkout(routine?: Routine) {
  const start = Date.now();
  const exercises: WorkoutExercise[] = (routine?.exercises ?? []).map((re: RoutineExercise) => ({
    id: uid(),
    exerciseId: re.exerciseId,
    restSec: re.restSec,
    superset: re.superset,
    notes: re.notes,
    // Routine values become placeholders, not entries: the coach and the last
    // session decide what to aim for, and an untouched set is still empty.
    sets: (re.sets.length ? re.sets : [{ type: 'normal' as const }]).map((s) => ({ ...newSet(s.type) })),
  }));
  setActive({ id: uid(), name: routine?.name ?? defaultName(start), start, exercises, routineId: routine?.id });
}

export function updateActive(fn: (w: Workout) => Workout) {
  if (!state.active) return;
  setActive(fn(state.active));
}

export function discardActive() {
  set({ rest: null });
  setActive(null);
}

/**
 * Finish the workout in progress. Unticked sets are dropped and exercises left
 * with no sets go with them. Returns the saved workout, or null if nothing at
 * all was logged.
 */
export function finishActive(): Workout | null {
  const w = state.active;
  if (!w) return null;
  const exercises = w.exercises
    .map((we) => ({ ...we, sets: we.sets.filter((s) => s.done) }))
    .filter((we) => we.sets.length);
  set({ rest: null });
  setActive(null);
  if (!exercises.length) return null;
  const done: Workout = { ...w, exercises, end: Date.now() };
  updateDb({ workouts: [...state.db.workouts, done] });
  return done;
}

export function saveWorkout(w: Workout) {
  const workouts = state.db.workouts.filter((x) => x.id !== w.id);
  workouts.push(w);
  updateDb({ workouts });
}

export function deleteWorkout(id: string) {
  updateDb({ workouts: state.db.workouts.filter((w) => w.id !== id) });
}

// ---------------------------------------------------------------------------
// Rest timer

export function startRest(seconds: number, exerciseName: string) {
  if (seconds <= 0) return;
  set({ rest: { endsAt: Date.now() + seconds * 1000, total: seconds, exerciseName } });
  saveActive();
}

export function adjustRest(delta: number) {
  const r = state.rest;
  if (!r) return;
  const endsAt = r.endsAt + delta * 1000;
  if (endsAt <= Date.now()) set({ rest: null });
  else set({ rest: { ...r, endsAt, total: Math.max(1, r.total + delta) } });
  saveActive();
}

export function stopRest() {
  set({ rest: null });
  saveActive();
}

// ---------------------------------------------------------------------------
// Measurements

export function addMeasurement(m: Omit<Measurement, 'id'>) {
  updateDb({ measurements: [...state.db.measurements, { ...m, id: uid() }] });
}

export function deleteMeasurement(id: string) {
  updateDb({ measurements: state.db.measurements.filter((m) => m.id !== id) });
}

// ---------------------------------------------------------------------------
// Bulk

export function importData(workouts: Workout[], exercises: Exercise[]) {
  updateDb({
    workouts: [...state.db.workouts, ...workouts],
    exercises: [...state.db.exercises, ...exercises],
  });
}

export function replaceDatabase(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Database).workouts)) return false;
  const db = migrate(raw as Partial<Database>);
  set({ db, exercises: mergeExercises(db.exercises) });
  saveDb();
  return true;
}

export function eraseEverything() {
  const db = emptyDb();
  set({ db, exercises: mergeExercises([]), active: null, rest: null });
  saveDb();
  saveActive();
}
