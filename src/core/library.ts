// The built-in exercise library.
//
// Names follow the "Movement (Equipment)" convention most lifting apps share,
// which is what lets a history exported from another app land on the right
// exercise when it is imported here.

import type { Equipment, Exercise, ExerciseKind, Muscle } from './types.ts';

const EQUIP_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  smith: 'Smith Machine',
  'ez bar': 'EZ Bar',
  'trap bar': 'Trap Bar',
  plate: 'Plate',
  cardio: 'Cardio',
  other: 'Other',
};

export function equipmentLabel(e: Equipment): string {
  return EQUIP_LABEL[e];
}

export function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type Row = [name: string, equip: Equipment[], muscle: Muscle, secondary?: string, kind?: ExerciseKind];

// One row per movement; a row with several equipment entries expands into
// "Movement (Equipment)" for each. A single 'bodyweight' or 'cardio' entry keeps
// the bare name, as does a row whose name already carries its equipment.
const ROWS: Row[] = [
  // Chest
  ['Bench Press', ['barbell', 'dumbbell', 'smith', 'machine'], 'chest', 'triceps,shoulders'],
  ['Incline Bench Press', ['barbell', 'dumbbell', 'smith'], 'chest', 'shoulders,triceps'],
  ['Decline Bench Press', ['barbell', 'dumbbell'], 'chest', 'triceps'],
  ['Close Grip Bench Press', ['barbell'], 'triceps', 'chest'],
  ['Floor Press', ['barbell', 'dumbbell'], 'chest', 'triceps'],
  ['Chest Fly', ['dumbbell', 'machine', 'band'], 'chest', 'shoulders'],
  ['Incline Chest Fly', ['dumbbell'], 'chest', 'shoulders'],
  ['Cable Crossover', ['cable'], 'chest', 'shoulders'],
  ['Low Cable Fly', ['cable'], 'chest', 'shoulders'],
  ['Pec Deck', ['machine'], 'chest'],
  ['Chest Press', ['machine', 'cable'], 'chest', 'triceps'],
  ['Push Up', ['bodyweight'], 'chest', 'triceps,shoulders,core', 'reps'],
  ['Incline Push Up', ['bodyweight'], 'chest', 'triceps', 'reps'],
  ['Decline Push Up', ['bodyweight'], 'chest', 'shoulders,triceps', 'reps'],
  ['Chest Dip', ['bodyweight'], 'chest', 'triceps,shoulders', 'reps'],
  ['Pullover', ['dumbbell'], 'chest', 'back'],

  // Back
  ['Deadlift', ['barbell', 'dumbbell', 'trap bar'], 'back', 'hamstrings,glutes,lower back,traps,forearms'],
  ['Sumo Deadlift', ['barbell'], 'glutes', 'back,quads,adductors,hamstrings'],
  ['Rack Pull', ['barbell'], 'back', 'traps,lower back'],
  ['Pull Up', ['bodyweight'], 'back', 'biceps,forearms', 'reps'],
  ['Chin Up', ['bodyweight'], 'back', 'biceps', 'reps'],
  ['Neutral Grip Pull Up', ['bodyweight'], 'back', 'biceps', 'reps'],
  ['Pull Up (Assisted)', ['machine'], 'back', 'biceps', 'assisted'],
  ['Chin Up (Assisted)', ['machine'], 'back', 'biceps', 'assisted'],
  ['Lat Pulldown', ['cable', 'machine'], 'back', 'biceps'],
  ['Lat Pulldown - Close Grip', ['cable'], 'back', 'biceps'],
  ['Straight Arm Pulldown', ['cable'], 'back'],
  ['Bent Over Row', ['barbell', 'dumbbell'], 'back', 'biceps,traps,lower back'],
  ['Pendlay Row', ['barbell'], 'back', 'traps,biceps'],
  ['T Bar Row', ['barbell', 'machine'], 'back', 'traps,biceps'],
  ['Seated Row', ['cable', 'machine'], 'back', 'biceps,traps'],
  ['Chest Supported Row', ['dumbbell', 'machine'], 'back', 'traps,biceps'],
  ['Single Arm Row', ['dumbbell', 'cable'], 'back', 'biceps'],
  ['Inverted Row', ['bodyweight'], 'back', 'biceps', 'reps'],
  ['Face Pull', ['cable', 'band'], 'shoulders', 'traps,back'],
  ['Shrug', ['barbell', 'dumbbell', 'trap bar', 'machine'], 'traps', 'forearms'],
  ['Back Extension', ['bodyweight', 'machine'], 'lower back', 'glutes,hamstrings'],
  ['Good Morning', ['barbell'], 'hamstrings', 'lower back,glutes'],
  ['Superman', ['bodyweight'], 'lower back', 'glutes', 'reps'],

  // Shoulders
  ['Overhead Press', ['barbell', 'dumbbell', 'smith'], 'shoulders', 'triceps,traps'],
  ['Seated Overhead Press', ['barbell', 'dumbbell'], 'shoulders', 'triceps'],
  ['Shoulder Press', ['machine'], 'shoulders', 'triceps'],
  ['Arnold Press', ['dumbbell'], 'shoulders', 'triceps'],
  ['Push Press', ['barbell'], 'shoulders', 'triceps,quads'],
  ['Lateral Raise', ['dumbbell', 'cable', 'machine', 'band'], 'shoulders'],
  ['Front Raise', ['dumbbell', 'cable', 'plate', 'barbell'], 'shoulders'],
  ['Reverse Fly', ['dumbbell', 'cable', 'machine'], 'shoulders', 'traps,back'],
  ['Upright Row', ['barbell', 'dumbbell', 'cable'], 'shoulders', 'traps'],
  ['Landmine Press', ['barbell'], 'shoulders', 'chest,triceps'],
  ['Handstand Push Up', ['bodyweight'], 'shoulders', 'triceps', 'reps'],

  // Arms
  ['Bicep Curl', ['barbell', 'dumbbell', 'cable', 'machine', 'ez bar', 'band'], 'biceps', 'forearms'],
  ['Hammer Curl', ['dumbbell', 'cable'], 'biceps', 'forearms'],
  ['Preacher Curl', ['barbell', 'dumbbell', 'machine', 'ez bar'], 'biceps'],
  ['Incline Curl', ['dumbbell'], 'biceps'],
  ['Concentration Curl', ['dumbbell'], 'biceps'],
  ['Spider Curl', ['dumbbell', 'ez bar'], 'biceps'],
  ['Reverse Curl', ['barbell', 'ez bar', 'cable'], 'forearms', 'biceps'],
  ['Triceps Pushdown', ['cable'], 'triceps'],
  ['Triceps Pushdown - Rope', ['cable'], 'triceps'],
  ['Triceps Extension', ['dumbbell', 'cable', 'machine'], 'triceps'],
  ['Overhead Triceps Extension', ['dumbbell', 'cable', 'ez bar'], 'triceps'],
  ['Skullcrusher', ['barbell', 'dumbbell', 'ez bar'], 'triceps'],
  ['Triceps Kickback', ['dumbbell', 'cable'], 'triceps'],
  ['Triceps Dip', ['bodyweight'], 'triceps', 'chest,shoulders', 'reps'],
  ['Triceps Dip (Assisted)', ['machine'], 'triceps', 'chest', 'assisted'],
  ['Bench Dip', ['bodyweight'], 'triceps', 'shoulders', 'reps'],
  ['Diamond Push Up', ['bodyweight'], 'triceps', 'chest', 'reps'],
  ['Wrist Curl', ['barbell', 'dumbbell'], 'forearms'],
  ['Reverse Wrist Curl', ['barbell', 'dumbbell'], 'forearms'],
  ["Farmer's Walk", ['dumbbell', 'trap bar', 'kettlebell'], 'forearms', 'traps,core,full body'],
  ['Dead Hang', ['bodyweight'], 'forearms', 'back', 'time'],

  // Legs
  ['Squat', ['barbell', 'dumbbell', 'smith', 'machine'], 'quads', 'glutes,adductors,lower back'],
  ['Front Squat', ['barbell'], 'quads', 'glutes,core'],
  ['High Bar Squat', ['barbell'], 'quads', 'glutes'],
  ['Low Bar Squat', ['barbell'], 'glutes', 'quads,hamstrings,lower back'],
  ['Box Squat', ['barbell'], 'quads', 'glutes'],
  ['Pause Squat', ['barbell'], 'quads', 'glutes'],
  ['Goblet Squat', ['dumbbell', 'kettlebell'], 'quads', 'glutes,core'],
  ['Hack Squat', ['machine', 'barbell'], 'quads', 'glutes'],
  ['Belt Squat', ['machine'], 'quads', 'glutes'],
  ['Pistol Squat', ['bodyweight'], 'quads', 'glutes,core', 'reps'],
  ['Air Squat', ['bodyweight'], 'quads', 'glutes', 'reps'],
  ['Leg Press', ['machine'], 'quads', 'glutes,hamstrings'],
  ['Single Leg Press', ['machine'], 'quads', 'glutes'],
  ['Leg Extension', ['machine'], 'quads'],
  ['Bulgarian Split Squat', ['dumbbell', 'barbell', 'bodyweight'], 'quads', 'glutes'],
  ['Lunge', ['dumbbell', 'barbell', 'bodyweight'], 'quads', 'glutes,hamstrings'],
  ['Walking Lunge', ['dumbbell', 'bodyweight'], 'quads', 'glutes'],
  ['Reverse Lunge', ['dumbbell', 'barbell'], 'quads', 'glutes'],
  ['Step Up', ['dumbbell', 'barbell'], 'quads', 'glutes'],
  ['Romanian Deadlift', ['barbell', 'dumbbell'], 'hamstrings', 'glutes,lower back'],
  ['Stiff Leg Deadlift', ['barbell', 'dumbbell'], 'hamstrings', 'glutes,lower back'],
  ['Single Leg Romanian Deadlift', ['dumbbell', 'kettlebell'], 'hamstrings', 'glutes'],
  ['Lying Leg Curl', ['machine'], 'hamstrings'],
  ['Seated Leg Curl', ['machine'], 'hamstrings'],
  ['Standing Leg Curl', ['machine', 'cable'], 'hamstrings'],
  ['Nordic Hamstring Curl', ['bodyweight'], 'hamstrings', '', 'reps'],
  ['Glute Ham Raise', ['bodyweight'], 'hamstrings', 'glutes', 'reps'],
  ['Hip Thrust', ['barbell', 'machine', 'smith'], 'glutes', 'hamstrings'],
  ['Glute Bridge', ['barbell', 'bodyweight'], 'glutes', 'hamstrings'],
  ['Cable Pull Through', ['cable'], 'glutes', 'hamstrings'],
  ['Glute Kickback', ['cable', 'machine'], 'glutes'],
  ['Hip Abduction', ['machine', 'cable', 'band'], 'glutes'],
  ['Hip Adduction', ['machine', 'cable'], 'adductors'],
  ['Kettlebell Swing', ['kettlebell'], 'glutes', 'hamstrings,core,full body'],
  ['Standing Calf Raise', ['machine', 'barbell', 'dumbbell', 'smith'], 'calves'],
  ['Seated Calf Raise', ['machine', 'dumbbell'], 'calves'],
  ['Calf Press on Leg Press', ['machine'], 'calves'],
  ['Tibialis Raise', ['bodyweight', 'machine'], 'calves'],

  // Core
  ['Plank', ['bodyweight'], 'core', '', 'time'],
  ['Side Plank', ['bodyweight'], 'core', '', 'time'],
  ['Hollow Hold', ['bodyweight'], 'core', '', 'time'],
  ['Crunch', ['bodyweight', 'machine', 'cable'], 'core'],
  ['Cable Crunch', ['cable'], 'core'],
  ['Sit Up', ['bodyweight'], 'core', '', 'reps'],
  ['Decline Crunch', ['bodyweight'], 'core', '', 'reps'],
  ['Hanging Leg Raise', ['bodyweight'], 'core', 'forearms', 'reps'],
  ['Hanging Knee Raise', ['bodyweight'], 'core', '', 'reps'],
  ['Lying Leg Raise', ['bodyweight'], 'core', '', 'reps'],
  ['Ab Wheel Rollout', ['bodyweight'], 'core', 'shoulders', 'reps'],
  ['Russian Twist', ['bodyweight', 'dumbbell', 'plate'], 'core'],
  ['Pallof Press', ['cable', 'band'], 'core'],
  ['Woodchopper', ['cable'], 'core'],
  ['Dead Bug', ['bodyweight'], 'core', '', 'reps'],
  ['Bicycle Crunch', ['bodyweight'], 'core', '', 'reps'],
  ['Mountain Climber', ['bodyweight'], 'core', 'full body', 'reps'],
  ['Back Extension (Weighted)', ['plate'], 'lower back', 'glutes,hamstrings'],

  // Olympic and full body
  ['Power Clean', ['barbell'], 'full body', 'traps,quads,glutes,hamstrings'],
  ['Hang Clean', ['barbell'], 'full body', 'traps,quads'],
  ['Clean and Jerk', ['barbell'], 'full body', 'shoulders,quads,glutes'],
  ['Snatch', ['barbell'], 'full body', 'shoulders,quads,glutes'],
  ['Thruster', ['barbell', 'dumbbell'], 'full body', 'quads,shoulders'],
  ['Turkish Get Up', ['kettlebell'], 'full body', 'shoulders,core'],
  ['Burpee', ['bodyweight'], 'full body', 'chest,quads', 'reps'],
  ['Box Jump', ['bodyweight'], 'quads', 'glutes,calves', 'reps'],
  ['Sled Push', ['other'], 'full body', 'quads,glutes', 'weight'],
  ['Battle Ropes', ['other'], 'full body', 'shoulders', 'time'],

  // Cardio
  ['Running', ['cardio'], 'cardio', '', 'cardio'],
  ['Running (Treadmill)', ['cardio'], 'cardio', '', 'cardio'],
  ['Cycling', ['cardio'], 'cardio', '', 'cardio'],
  ['Cycling (Indoor)', ['cardio'], 'cardio', '', 'cardio'],
  ['Rowing (Machine)', ['cardio'], 'cardio', 'back', 'cardio'],
  ['Elliptical', ['cardio'], 'cardio', '', 'cardio'],
  ['Stair Climber', ['cardio'], 'cardio', 'glutes', 'cardio'],
  ['Walking', ['cardio'], 'cardio', '', 'cardio'],
  ['Swimming', ['cardio'], 'cardio', 'full body', 'cardio'],
  ['Jump Rope', ['cardio'], 'cardio', 'calves', 'time'],
  ['Ski Erg', ['cardio'], 'cardio', 'back', 'cardio'],
  ['Assault Bike', ['cardio'], 'cardio', 'full body', 'cardio'],
];

function build(): Exercise[] {
  const out: Exercise[] = [];
  for (const [base, equips, muscle, secondary = '', kind = 'weight'] of ROWS) {
    const bare = equips.length === 1 && (equips[0] === 'bodyweight' || equips[0] === 'cardio' || base.includes('('));
    for (const equipment of equips) {
      // A bodyweight variant of a loaded movement still records reps, with any
      // vest or belt load as added weight.
      const k: ExerciseKind = equipment === 'bodyweight' && kind === 'weight' ? 'reps' : kind;
      const name = bare ? base : `${base} (${EQUIP_LABEL[equipment]})`;
      out.push({
        id: slug(name),
        name,
        muscle,
        secondary: secondary ? (secondary.split(',') as Muscle[]) : [],
        equipment,
        kind: k,
      });
    }
  }
  return out;
}

export const LIBRARY: Exercise[] = build();

export const MUSCLES: Muscle[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps', 'core',
  'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'lower back', 'full body', 'cardio', 'other',
];

export const EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'smith',
  'ez bar', 'trap bar', 'band', 'plate', 'cardio', 'other',
];

/** A canonical form for matching names across apps: case, punctuation, plurals. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/biceps/g, 'bicep')
    .replace(/tricep\b/g, 'triceps')
    .replace(/pull[\s-]?ups?/g, 'pull up')
    .replace(/chin[\s-]?ups?/g, 'chin up')
    .replace(/push[\s-]?ups?/g, 'push up')
    .replace(/sit[\s-]?ups?/g, 'sit up')
    .replace(/step[\s-]?ups?/g, 'step up')
    .replace(/skull ?crushers?/g, 'skullcrusher')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bkb\b/g, 'kettlebell')
    .replace(/\brdl\b/g, 'romanian deadlift')
    .replace(/\bohp\b/g, 'overhead press')
    .replace(/smith machine/g, 'smith')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(\w{4,})s\b/g, '$1')
    .trim();
}
