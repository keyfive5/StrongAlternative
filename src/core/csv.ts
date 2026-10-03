// Import from other lifting apps, and export in a format they can read back.
//
// Leaving an app should never cost you your history, in either direction. The
// importer reads Strong's CSV exports (old comma format, old semicolon format
// with unit columns, and the 6.x format with units in the headers) and Hevy's
// CSV export. The exporter writes Strong's 6.x layout, so a history kept here
// can be imported anywhere that already understands Strong.

import { LIBRARY, nameKey, slug } from './library.ts';
import type { Equipment, Exercise, ExerciseKind, SetType, Unit, Workout, WorkoutExercise, WorkoutSet } from './types.ts';
import { uid } from './types.ts';
import { LB_PER_KG } from './units.ts';

// ---------------------------------------------------------------------------
// CSV tokenising

export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

/** RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes, CRLF. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function csvField(v: string | number | undefined, delimiter: string): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// ---------------------------------------------------------------------------
// Dates and durations

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** "2024-03-15 18:05:31", "2024-03-15T18:05", "15 Mar 2024, 18:05". Local time. */
export function parseDate(text: string): number | undefined {
  const t = text.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
  }
  m = t.match(/^(\d{1,2}) ([A-Za-z]{3,4})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5]).getTime();
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,? (\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2], +(m[4] ?? 0), +(m[5] ?? 0)).getTime();
  const fallback = Date.parse(t);
  return Number.isFinite(fallback) ? fallback : undefined;
}

/** "1h 5m", "45m", "50s", "3725" (seconds) → seconds. */
export function parseDuration(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t));
  let total = 0;
  let matched = false;
  for (const [, n, u] of t.matchAll(/(\d+(?:\.\d+)?)\s*([hms])/gi)) {
    matched = true;
    total += Number(n) * (u.toLowerCase() === 'h' ? 3600 : u.toLowerCase() === 'm' ? 60 : 1);
  }
  const clock = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    return clock[3] !== undefined ? +clock[1] * 3600 + +clock[2] * 60 + +clock[3] : +clock[1] * 60 + +clock[2];
  }
  return matched ? Math.round(total) : undefined;
}

function num(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Exercise matching

const EQUIP_WORDS: [RegExp, Equipment][] = [
  [/barbell/i, 'barbell'],
  [/dumbbell/i, 'dumbbell'],
  [/smith/i, 'smith'],
  [/cable/i, 'cable'],
  [/machine/i, 'machine'],
  [/kettlebell/i, 'kettlebell'],
  [/band/i, 'band'],
  [/ez ?bar/i, 'ez bar'],
  [/trap ?bar|hex/i, 'trap bar'],
  [/plate/i, 'plate'],
  [/bodyweight|assisted|weighted/i, 'bodyweight'],
];

export function guessEquipment(name: string): Equipment {
  const paren = name.match(/\(([^)]*)\)/)?.[1] ?? name;
  for (const [re, e] of EQUIP_WORDS) if (re.test(paren)) return e;
  return 'other';
}

/** Which variant a bare movement name most likely means. */
const BASE_PREFERENCE: Equipment[] = ['barbell', 'machine', 'bodyweight', 'dumbbell', 'cable', 'smith', 'kettlebell', 'ez bar'];

export class ExerciseMatcher {
  private byKey = new Map<string, Exercise>();
  /** Movement name without its equipment → the variants, best guess first. */
  private byBase = new Map<string, Exercise[]>();
  readonly created: Exercise[] = [];

  constructor(existing: Exercise[]) {
    for (const ex of [...LIBRARY, ...existing]) {
      this.byKey.set(nameKey(ex.name), ex);
      const base = nameKey(ex.name.replace(/\s*\([^)]*\)\s*$/, ''));
      const list = this.byBase.get(base) ?? [];
      list.push(ex);
      this.byBase.set(base, list);
    }
    const rank = (e: Exercise) => {
      const i = BASE_PREFERENCE.indexOf(e.equipment);
      return i === -1 ? 99 : i;
    };
    for (const list of this.byBase.values()) list.sort((a, b) => rank(a) - rank(b));
  }

  find(name: string): Exercise | undefined {
    const key = nameKey(name);
    const hit = this.byKey.get(key);
    if (hit) return hit;
    // "Squat (Barbell)" in one app is "Barbell Squat" in another.
    const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (m) {
      const swapped = this.byKey.get(nameKey(`${m[2]} ${m[1]}`));
      if (swapped) return swapped;
    } else {
      for (const [re, e] of EQUIP_WORDS) {
        const word = name.match(re)?.[0];
        if (!word) continue;
        const rest = name.replace(word, '').replace(/\s+/g, ' ').trim();
        const label = e === 'smith' ? 'Smith Machine' : e.replace(/\b\w/g, (c) => c.toUpperCase());
        const alt = this.byKey.get(nameKey(`${rest} (${label})`));
        if (alt) return alt;
      }
      // A bare movement name ("Leg Press") means its most usual variant.
      const variants = this.byBase.get(key);
      if (variants?.length) return variants[0];
    }
    return undefined;
  }

  /** Find, or create a custom exercise shaped by the data seen for it. */
  resolve(name: string, kind: ExerciseKind): Exercise {
    const found = this.find(name);
    if (found) return found;
    const ex: Exercise = {
      id: 'c-' + slug(name) + '-' + uid().slice(-4),
      name: name.trim(),
      muscle: kind === 'cardio' ? 'cardio' : 'other',
      secondary: [],
      equipment: kind === 'cardio' ? 'cardio' : guessEquipment(name),
      kind,
      custom: true,
    };
    this.byKey.set(nameKey(name), ex);
    this.created.push(ex);
    return ex;
  }
}

// ---------------------------------------------------------------------------
// Import

export interface ImportResult {
  source: 'strong' | 'hevy' | 'unknown';
  workouts: Workout[];
  newExercises: Exercise[];
  sets: number;
  skippedDuplicates: number;
  warnings: string[];
  /** Weight unit the file was read as. */
  unit: Unit;
}

interface RawSet {
  workoutKey: string;
  workoutName: string;
  start: number;
  durationSec?: number;
  end?: number;
  workoutNotes?: string;
  exercise: string;
  exerciseNotes?: string;
  superset?: string;
  type: SetType;
  weightKg?: number;
  reps?: number;
  seconds?: number;
  distanceM?: number;
  rpe?: number;
  order: number;
}

function header(rows: string[][]): Map<string, number> {
  const map = new Map<string, number>();
  rows[0].forEach((h, i) => map.set(h.trim().toLowerCase(), i));
  return map;
}

function col(h: Map<string, number>, ...names: string[]): number {
  for (const n of names) {
    const i = h.get(n);
    if (i !== undefined) return i;
  }
  for (const n of names) {
    for (const [k, i] of h) if (k.startsWith(n)) return i;
  }
  return -1;
}

function setTypeFrom(code: string): SetType | 'skip' {
  const c = code.trim().toLowerCase();
  if (c === 'w' || c === 'warmup' || c === 'warm up' || c === 'warm-up') return 'warmup';
  if (c === 'd' || c === 'dropset' || c === 'drop') return 'drop';
  if (c === 'f' || c === 'failure') return 'failure';
  if (c.includes('rest')) return 'skip';
  return 'normal';
}

/**
 * Read a CSV export. `assumeUnit` is used when the file does not say which unit
 * its weights are in (Strong's original comma format does not).
 */
export function importCsv(text: string, existing: Exercise[], existingWorkouts: Workout[], assumeUnit: Unit = 'kg'): ImportResult {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length < 2) {
    return { source: 'unknown', workouts: [], newExercises: [], sets: 0, skippedDuplicates: 0, warnings: ['The file has no rows.'], unit: assumeUnit };
  }
  const h = header(rows);
  const isHevy = h.has('exercise_title') && h.has('start_time');
  const isStrong = h.has('exercise name') && h.has('date');
  if (!isHevy && !isStrong) {
    return {
      source: 'unknown', workouts: [], newExercises: [], sets: 0, skippedDuplicates: 0, unit: assumeUnit,
      warnings: ['This does not look like a Strong or Hevy export. Expected a column called "Exercise Name" or "exercise_title".'],
    };
  }

  const raws: RawSet[] = [];
  let unit: Unit = assumeUnit;

  if (isStrong) {
    const iDate = col(h, 'date');
    const iName = col(h, 'workout name');
    const iDur = col(h, 'duration', 'workout duration');
    const iEx = col(h, 'exercise name');
    const iOrder = col(h, 'set order');
    const iW = col(h, 'weight');
    const iWU = col(h, 'weight unit');
    const iReps = col(h, 'reps');
    const iDist = col(h, 'distance');
    const iDU = col(h, 'distance unit');
    const iSec = col(h, 'seconds');
    const iNotes = col(h, 'notes');
    const iWNotes = col(h, 'workout notes');
    const iRpe = col(h, 'rpe');
    const iNum = col(h, 'workout #');
    const weightHeader = iW >= 0 ? rows[0][iW].toLowerCase() : '';
    if (/lb/.test(weightHeader)) unit = 'lb';
    else if (/kg/.test(weightHeader)) unit = 'kg';
    const distHeader = iDist >= 0 ? rows[0][iDist].toLowerCase() : '';
    // Old comma format: distance in the user's unit, which follows the weight unit.
    const distScale = /meter|\(m\)/.test(distHeader) ? 1 : /mile|\(mi\)/.test(distHeader) ? 1609.344 : /km/.test(distHeader) ? 1000 : unit === 'lb' ? 1609.344 : 1000;
    let order = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const start = parseDate(row[iDate] ?? '');
      const exercise = (row[iEx] ?? '').trim();
      if (start === undefined || !exercise) continue;
      const type = setTypeFrom(iOrder >= 0 ? row[iOrder] ?? '' : '');
      if (type === 'skip') continue;
      const rowUnit = iWU >= 0 ? (/lb/i.test(row[iWU] ?? '') ? 'lb' : /kg/i.test(row[iWU] ?? '') ? 'kg' : unit) : unit;
      if (iWU >= 0) unit = rowUnit;
      const w = num(row[iW]);
      let dScale = distScale;
      if (iDU >= 0) {
        const du = (row[iDU] ?? '').toLowerCase();
        dScale = du.startsWith('mi') ? 1609.344 : du === 'm' ? 1 : du === 'km' ? 1000 : distScale;
      }
      const d = num(row[iDist]);
      const name = (row[iName] ?? 'Workout').trim() || 'Workout';
      raws.push({
        workoutKey: `${iNum >= 0 ? row[iNum] : ''}|${start}|${name}`,
        workoutName: name,
        start,
        durationSec: iDur >= 0 ? parseDuration(row[iDur] ?? '') : undefined,
        workoutNotes: iWNotes >= 0 ? row[iWNotes]?.trim() || undefined : undefined,
        exercise,
        exerciseNotes: iNotes >= 0 ? row[iNotes]?.trim() || undefined : undefined,
        type,
        weightKg: w !== undefined && w !== 0 ? (rowUnit === 'lb' ? w / LB_PER_KG : w) : w,
        reps: num(row[iReps]),
        seconds: num(row[iSec]) || undefined,
        distanceM: d ? d * dScale : undefined,
        rpe: num(row[iRpe]) || undefined,
        order: order++,
      });
    }
  } else {
    const iTitle = col(h, 'title');
    const iStart = col(h, 'start_time');
    const iEnd = col(h, 'end_time');
    const iDesc = col(h, 'description');
    const iEx = col(h, 'exercise_title');
    const iSuper = col(h, 'superset_id');
    const iExNotes = col(h, 'exercise_notes');
    const iType = col(h, 'set_type');
    const iKg = col(h, 'weight_kg');
    const iLb = col(h, 'weight_lbs');
    const iReps = col(h, 'reps');
    const iKm = col(h, 'distance_km');
    const iMi = col(h, 'distance_miles');
    const iDur = col(h, 'duration_seconds');
    const iRpe = col(h, 'rpe');
    unit = iLb >= 0 && iKg < 0 ? 'lb' : 'kg';
    let order = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const start = parseDate(row[iStart] ?? '');
      const exercise = (row[iEx] ?? '').trim();
      if (start === undefined || !exercise) continue;
      const type = setTypeFrom(row[iType] ?? '');
      if (type === 'skip') continue;
      const kg = iKg >= 0 ? num(row[iKg]) : undefined;
      const lb = iLb >= 0 ? num(row[iLb]) : undefined;
      const km = iKm >= 0 ? num(row[iKm]) : undefined;
      const mi = iMi >= 0 ? num(row[iMi]) : undefined;
      const name = (row[iTitle] ?? 'Workout').trim() || 'Workout';
      raws.push({
        workoutKey: `${start}|${name}`,
        workoutName: name,
        start,
        end: iEnd >= 0 ? parseDate(row[iEnd] ?? '') : undefined,
        workoutNotes: iDesc >= 0 ? row[iDesc]?.trim() || undefined : undefined,
        exercise,
        exerciseNotes: iExNotes >= 0 ? row[iExNotes]?.trim() || undefined : undefined,
        superset: iSuper >= 0 ? row[iSuper]?.trim() || undefined : undefined,
        type,
        weightKg: kg ?? (lb !== undefined ? lb / LB_PER_KG : undefined),
        reps: num(row[iReps]),
        seconds: num(row[iDur]) || undefined,
        distanceM: km ? km * 1000 : mi ? mi * 1609.344 : undefined,
        rpe: num(row[iRpe]) || undefined,
        order: order++,
      });
    }
  }

  // Decide each exercise's kind from everything seen for it, before creating.
  const shape = new Map<string, { w: boolean; r: boolean; s: boolean; d: boolean }>();
  for (const s of raws) {
    const k = shape.get(s.exercise) ?? { w: false, r: false, s: false, d: false };
    if ((s.weightKg ?? 0) > 0) k.w = true;
    if ((s.reps ?? 0) > 0) k.r = true;
    if ((s.seconds ?? 0) > 0) k.s = true;
    if ((s.distanceM ?? 0) > 0) k.d = true;
    shape.set(s.exercise, k);
  }
  const matcher = new ExerciseMatcher(existing);
  const exerciseFor = new Map<string, Exercise>();
  for (const [name, k] of shape) {
    const kind: ExerciseKind = k.d ? 'cardio' : k.w ? 'weight' : k.r ? 'reps' : k.s ? 'time' : 'weight';
    exerciseFor.set(name, matcher.resolve(name, kind));
  }

  // Group into workouts, keeping the file's own order within each.
  const groups = new Map<string, RawSet[]>();
  for (const s of raws) {
    const g = groups.get(s.workoutKey);
    if (g) g.push(s);
    else groups.set(s.workoutKey, [s]);
  }
  const existingStarts = new Set(existingWorkouts.map((w) => `${Math.round(w.start / 60000)}|${w.name.toLowerCase()}`));
  const workouts: Workout[] = [];
  let skippedDuplicates = 0;
  let setCount = 0;
  for (const g of groups.values()) {
    const first = g[0];
    if (existingStarts.has(`${Math.round(first.start / 60000)}|${first.workoutName.toLowerCase()}`)) {
      skippedDuplicates++;
      continue;
    }
    const exercises: WorkoutExercise[] = [];
    let current: WorkoutExercise | undefined;
    let currentName = '';
    for (const s of g.sort((a, b) => a.order - b.order)) {
      const ex = exerciseFor.get(s.exercise)!;
      if (!current || currentName !== s.exercise) {
        current = { id: uid(), exerciseId: ex.id, sets: [], notes: s.exerciseNotes, superset: s.superset };
        currentName = s.exercise;
        exercises.push(current);
      }
      const set: WorkoutSet = { id: uid(), type: s.type, done: true };
      if (s.weightKg !== undefined && (s.weightKg > 0 || ex.kind === 'weight')) set.weight = Math.round(s.weightKg * 10000) / 10000;
      if (s.reps !== undefined && s.reps > 0) set.reps = s.reps;
      if (s.seconds) set.seconds = s.seconds;
      if (s.distanceM) set.distance = Math.round(s.distanceM * 100) / 100;
      if (s.rpe) set.rpe = s.rpe;
      if (!current.notes && s.exerciseNotes) current.notes = s.exerciseNotes;
      current.sets.push(set);
      setCount++;
    }
    const duration = first.durationSec;
    workouts.push({
      id: uid(),
      name: first.workoutName,
      start: first.start,
      end: first.end ?? first.start + (duration && duration > 0 ? duration : 3600) * 1000,
      exercises,
      notes: first.workoutNotes,
    });
  }
  if (!workouts.length && !skippedDuplicates) warnings.push('No workouts were found in the file.');
  return {
    source: isStrong ? 'strong' : 'hevy',
    workouts: workouts.sort((a, b) => a.start - b.start),
    newExercises: matcher.created,
    sets: setCount,
    skippedDuplicates,
    warnings,
    unit,
  };
}

// ---------------------------------------------------------------------------
// Export

function stamp(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const TYPE_CODE: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

/** Strong 6.x layout: semicolons, quoted, units in the headers. */
export function exportCsv(workouts: Workout[], exercises: Map<string, Exercise>, unit: Unit): string {
  const d = ';';
  const head = ['Workout #', 'Date', 'Workout Name', 'Duration (sec)', 'Exercise Name', 'Set Order', `Weight (${unit === 'kg' ? 'kg' : 'lbs'})`, 'Reps', 'RPE', 'Distance (meters)', 'Seconds', 'Notes', 'Workout Notes'];
  const lines = [head.map((x) => `"${x}"`).join(d)];
  const done = workouts.filter((w) => w.end).sort((a, b) => a.start - b.start);
  done.forEach((w, wi) => {
    const duration = Math.round(((w.end ?? w.start) - w.start) / 1000);
    for (const we of w.exercises) {
      const ex = exercises.get(we.exerciseId);
      let n = 0;
      for (const s of we.sets) {
        if (!s.done) continue;
        const order = s.type === 'normal' ? String(++n) : (s.type === 'failure' ? (++n, 'F') : TYPE_CODE[s.type]);
        const weight = s.weight !== undefined ? Math.round((unit === 'kg' ? s.weight : s.weight * LB_PER_KG) * 100) / 100 : '';
        lines.push(
          [
            wi + 1,
            stamp(w.start),
            w.name,
            duration,
            ex?.name ?? we.exerciseId,
            order,
            weight,
            s.reps ?? '',
            s.rpe ?? '',
            s.distance ?? '',
            s.seconds ?? '',
            we.notes ?? '',
            w.notes ?? '',
          ]
            .map((v) => csvField(v as string | number, d))
            .join(d),
        );
      }
    }
  });
  return lines.join('\n') + '\n';
}
