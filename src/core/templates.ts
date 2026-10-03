// Starter programmes, added to your routines with one tap. Rep counts are the
// bottom of each programme's range; the coach moves you up from there.

import type { Routine, RoutineSet } from './types.ts';
import { uid } from './types.ts';

interface Spec {
  name: string;
  exercises: [id: string, sets: number, reps: number][];
}

export interface Program {
  name: string;
  blurb: string;
  days: Spec[];
}

export const PROGRAMS: Program[] = [
  {
    name: 'Push / Pull / Legs',
    blurb: 'Six days a week, or three. The classic hypertrophy split.',
    days: [
      {
        name: 'Push',
        exercises: [
          ['bench-press-barbell', 4, 6],
          ['overhead-press-barbell', 3, 8],
          ['incline-bench-press-dumbbell', 3, 8],
          ['lateral-raise-dumbbell', 3, 12],
          ['triceps-pushdown-rope-cable', 3, 10],
        ],
      },
      {
        name: 'Pull',
        exercises: [
          ['deadlift-barbell', 3, 5],
          ['pull-up', 3, 6],
          ['seated-row-cable', 3, 8],
          ['face-pull-cable', 3, 12],
          ['bicep-curl-dumbbell', 3, 10],
        ],
      },
      {
        name: 'Legs',
        exercises: [
          ['squat-barbell', 4, 5],
          ['romanian-deadlift-barbell', 3, 8],
          ['leg-press-machine', 3, 10],
          ['seated-leg-curl-machine', 3, 10],
          ['standing-calf-raise-machine', 4, 10],
        ],
      },
    ],
  },
  {
    name: 'Upper / Lower',
    blurb: 'Four days a week. Each muscle twice, plenty of recovery.',
    days: [
      {
        name: 'Upper A',
        exercises: [
          ['bench-press-barbell', 4, 5],
          ['bent-over-row-barbell', 4, 6],
          ['overhead-press-dumbbell', 3, 8],
          ['lat-pulldown-cable', 3, 8],
          ['skullcrusher-ez-bar', 3, 10],
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          ['squat-barbell', 4, 5],
          ['romanian-deadlift-barbell', 3, 8],
          ['bulgarian-split-squat-dumbbell', 3, 8],
          ['lying-leg-curl-machine', 3, 10],
          ['hanging-leg-raise', 3, 10],
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          ['overhead-press-barbell', 4, 5],
          ['pull-up', 4, 6],
          ['incline-bench-press-dumbbell', 3, 8],
          ['chest-supported-row-dumbbell', 3, 8],
          ['hammer-curl-dumbbell', 3, 10],
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          ['deadlift-barbell', 3, 4],
          ['front-squat-barbell', 3, 6],
          ['hip-thrust-barbell', 3, 8],
          ['leg-extension-machine', 3, 12],
          ['seated-calf-raise-machine', 4, 12],
        ],
      },
    ],
  },
  {
    name: '5×5 Strength',
    blurb: 'Three days a week, alternating A and B. Add weight every session.',
    days: [
      {
        name: 'Workout A',
        exercises: [
          ['squat-barbell', 5, 5],
          ['bench-press-barbell', 5, 5],
          ['bent-over-row-barbell', 5, 5],
        ],
      },
      {
        name: 'Workout B',
        exercises: [
          ['squat-barbell', 5, 5],
          ['overhead-press-barbell', 5, 5],
          ['deadlift-barbell', 1, 5],
        ],
      },
    ],
  },
  {
    name: 'Full Body',
    blurb: 'Two or three days a week. The most return for the least time.',
    days: [
      {
        name: 'Full Body',
        exercises: [
          ['squat-barbell', 3, 6],
          ['bench-press-dumbbell', 3, 8],
          ['lat-pulldown-cable', 3, 8],
          ['romanian-deadlift-dumbbell', 3, 8],
          ['lateral-raise-dumbbell', 2, 12],
          ['plank', 2, 0],
        ],
      },
    ],
  },
];

/** Routine objects for a programme, ready to save. */
export function programRoutines(p: Program): Routine[] {
  return p.days.map((d) => ({
    id: uid(),
    name: d.name,
    folder: p.name,
    updated: Date.now(),
    exercises: d.exercises.map(([exerciseId, n]) => ({
      exerciseId,
      sets: Array.from({ length: n }, (): RoutineSet => ({ type: 'normal' })),
    })),
  }));
}
