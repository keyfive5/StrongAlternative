// The data model.
//
// Every weight is stored in kilograms and every distance in metres, whatever
// the user has chosen to see. Conversions happen only at the edges (display,
// input, CSV), so switching units can never round a lifetime of history.

export type Unit = 'kg' | 'lb';

export type Muscle =
  | 'chest' | 'back' | 'traps' | 'lower back' | 'shoulders' | 'biceps' | 'triceps'
  | 'forearms' | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'adductors'
  | 'full body' | 'cardio' | 'other';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell'
  | 'band' | 'smith' | 'ez bar' | 'trap bar' | 'plate' | 'cardio' | 'other';

/**
 * What a set of this exercise records.
 * - weight: load × reps (bench press)
 * - reps:   reps, optionally with added load (pull-up, push-up)
 * - assisted: assistance × reps, where less assistance is progress
 * - time:   seconds held (plank)
 * - cardio: distance and time (running)
 */
export type ExerciseKind = 'weight' | 'reps' | 'assisted' | 'time' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  kind: ExerciseKind;
  custom?: boolean;
  /** Rep range the progression coach works inside. */
  repMin?: number;
  repMax?: number;
  /** Load added when the top of the rep range is reached, in kg. */
  incrementKg?: number;
  notes?: string;
  archived?: boolean;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  id: string;
  type: SetType;
  /** kg. For 'reps' exercises this is added load; for 'assisted', assistance. */
  weight?: number;
  reps?: number;
  seconds?: number;
  /** metres */
  distance?: number;
  rpe?: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  /** Exercises sharing a superset id are performed back to back. */
  superset?: string;
  /** Rest after a completed set, in seconds. Falls back to settings. */
  restSec?: number;
}

export interface Workout {
  id: string;
  name: string;
  /** epoch ms */
  start: number;
  end?: number;
  exercises: WorkoutExercise[];
  notes?: string;
  routineId?: string;
}

export interface RoutineSet {
  type: SetType;
  weight?: number;
  reps?: number;
  seconds?: number;
  distance?: number;
}

export interface RoutineExercise {
  exerciseId: string;
  sets: RoutineSet[];
  restSec?: number;
  superset?: string;
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  notes?: string;
  folder?: string;
  updated: number;
}

export type MeasureKind =
  | 'bodyweight' | 'bodyfat' | 'waist' | 'chest' | 'hips' | 'neck' | 'shoulders'
  | 'arm' | 'forearm' | 'thigh' | 'calf';

export interface Measurement {
  id: string;
  kind: MeasureKind;
  at: number;
  /** kg for bodyweight, % for bodyfat, cm for everything else. */
  value: number;
}

export interface Settings {
  unit: Unit;
  /** Bar weight in kg. */
  barKg: number;
  /** Plates available, in the display unit, with the number of pairs owned. */
  plates: { weight: number; pairs: number }[];
  /** Default rest between sets, seconds. 0 disables the rest timer. */
  restSec: number;
  theme: 'system' | 'light' | 'dark';
  /** Monday = 1, Sunday = 0. */
  weekStart: 0 | 1;
  /** Count RPE when estimating 1RM (reps in reserve add to the reps done). */
  rpeAdjust: boolean;
  /** Weekly hard-set target per muscle, shown on the volume screen. */
  weeklySetTarget: number;
  haptics: boolean;
  keepAwake: boolean;
}

export interface Database {
  version: 1;
  exercises: Exercise[];
  workouts: Workout[];
  routines: Routine[];
  measurements: Measurement[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  barKg: 20,
  plates: [
    { weight: 25, pairs: 4 },
    { weight: 20, pairs: 4 },
    { weight: 15, pairs: 2 },
    { weight: 10, pairs: 2 },
    { weight: 5, pairs: 2 },
    { weight: 2.5, pairs: 2 },
    { weight: 1.25, pairs: 2 },
  ],
  restSec: 120,
  theme: 'system',
  weekStart: 1,
  rpeAdjust: true,
  weeklySetTarget: 10,
  haptics: true,
  keepAwake: true,
};

export const LB_PLATES = [
  { weight: 45, pairs: 4 },
  { weight: 35, pairs: 2 },
  { weight: 25, pairs: 2 },
  { weight: 10, pairs: 2 },
  { weight: 5, pairs: 2 },
  { weight: 2.5, pairs: 2 },
];

let counter = 0;
/** Short unique id. Time-ordered, so sorting by id roughly sorts by creation. */
export function uid(): string {
  counter = (counter + 1) % 1296;
  return (
    Date.now().toString(36) +
    counter.toString(36).padStart(2, '0') +
    Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')
  );
}
