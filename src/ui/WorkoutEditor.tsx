// The set-by-set logger. Used for the workout in progress (`live`) and for
// editing a finished workout after the fact.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { e1rm, exerciseHistory, type Session } from '../core/analytics.ts';
import { incrementKg, suggest, type Suggestion, type Target } from '../core/coach.ts';
import { warmupRamp } from '../core/plates.ts';
import type { Exercise, SetType, Unit, Workout, WorkoutExercise, WorkoutSet } from '../core/types.ts';
import { uid } from '../core/types.ts';
import { fmtEst, fmtNum, fmtWeight, fromDisplay, parseNum, roundTo, toDisplay } from '../core/units.ts';
import { newSet, startRest, useStore } from '../state/store.ts';
import { Icon, type IconName } from './Icon.tsx';
import { afterModal, Button, Chip, Field, haptic, IconButton, Sheet, SheetScroll, T, toast } from './kit.tsx';
import { useNav } from './nav.ts';
import { ExercisePicker } from './pickers.tsx';
import { PlateCalculator } from './tools.tsx';
import { radius, space, tabular, useTheme } from './theme.ts';

type Change = (fn: (w: Workout) => Workout) => void;

// ---------------------------------------------------------------------------
// Number entry that keeps what you are typing ("62." is not yet a number).
//
// On iPhone the number pad has no Done key, so every set field shares one bar
// above the keyboard: minus and plus step the focused field by the exercise's
// load increment or by one rep, and Done puts the keyboard away.

const BAR_ID = 'overload-number-bar';
let nudgeFocused: ((dir: 1 | -1) => void) | null = null;
let showSteppers: ((on: boolean) => void) | null = null;

export function NumberBar() {
  const c = useTheme();
  const [steppers, setSteppers] = useState(false);
  useEffect(() => {
    showSteppers = setSteppers;
    return () => {
      showSteppers = null;
    };
  }, []);
  if (Platform.OS !== 'ios') return null;
  const key = (label: string, a11y: string, onPress: () => void, primary = false) => (
    <Pressable
      key={a11y}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.barKey, { backgroundColor: primary ? c.accent : c.raised, opacity: pressed ? 0.6 : 1 }]}
    >
      <T v="bodyStrong" color={primary ? c.accentText : c.text}>
        {label}
      </T>
    </Pressable>
  );
  return (
    <InputAccessoryView nativeID={BAR_ID}>
      <View style={[styles.bar, { backgroundColor: c.surfaceAlt, borderTopColor: c.border }]}>
        {steppers ? [key('\u2212', 'Decrease', () => nudgeFocused?.(-1)), key('+', 'Increase', () => nudgeFocused?.(1))] : null}
        <View style={{ flex: 1 }} />
        {key('Done', 'Done', () => Keyboard.dismiss(), true)}
      </View>
    </InputAccessoryView>
  );
}

function NumInput({
  value,
  placeholder,
  onCommit,
  done,
  width,
  testID,
  clock,
  step,
}: {
  value: string;
  placeholder: string;
  onCommit: (text: string) => void;
  done: boolean;
  width?: number;
  testID?: string;
  clock?: boolean;
  /** How far the keyboard bar's minus and plus move this field. */
  step?: number;
}) {
  const c = useTheme();
  const [text, setText] = useState(value);
  const focused = useRef(false);
  const latest = useRef(text);
  latest.current = text;
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  const nudge = (dir: 1 | -1) => {
    if (!step) return;
    // An empty field steps from its placeholder: the target is the natural start.
    const from = parseNum(latest.current) ?? parseNum(placeholder) ?? 0;
    const next = fmtNum(Math.max(0, roundTo(from + dir * step, step < 1 ? 0.01 : step)));
    setText(next);
    onCommit(next);
    haptic();
  };
  return (
    <TextInput
      testID={testID}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={c.textFaint}
      keyboardType={clock ? 'numbers-and-punctuation' : 'decimal-pad'}
      inputAccessoryViewID={BAR_ID}
      selectTextOnFocus
      returnKeyType="done"
      onFocus={() => {
        focused.current = true;
        nudgeFocused = nudge;
        showSteppers?.(!!step);
      }}
      onBlur={() => {
        focused.current = false;
        if (nudgeFocused === nudge) nudgeFocused = null;
        onCommit(latest.current);
      }}
      onChangeText={(t) => {
        setText(t);
        onCommit(t);
      }}
      style={[
        styles.input,
        tabular,
        { width: width ?? undefined, flex: width ? undefined : 1, color: c.text, backgroundColor: done ? 'transparent' : c.surfaceAlt },
      ]}
    />
  );
}

/** "1:30" → 90, "90" → 90 for seconds fields; for minutes fields "25" → 1500. */
function parseClock(text: string, bareUnit: 'sec' | 'min'): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return m[3] !== undefined ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  const n = parseNum(t);
  if (n === undefined) return undefined;
  return Math.round(bareUnit === 'min' ? n * 60 : n);
}

function fmtClockShort(sec: number | undefined): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}:${String(s).padStart(2, '0')}` : String(s);
}

// ---------------------------------------------------------------------------
// Columns per exercise kind

interface Column {
  label: string;
  get: (s: Partial<WorkoutSet>) => string;
  set: (text: string) => Partial<WorkoutSet>;
  clock?: boolean;
  step?: number;
}

interface Columns {
  a?: Column;
  b: Column;
  /** Whether a set has what it needs to be ticked off. */
  complete: (s: Partial<WorkoutSet>) => boolean;
  fmt: (s: Partial<WorkoutSet>) => string;
}

function columns(ex: Exercise, unit: Unit): Columns {
  // The keyboard bar steps load by this exercise's progression increment.
  const loadStep = roundTo(toDisplay(incrementKg(ex, unit), unit), unit === 'kg' ? 0.25 : 0.5) || 1;
  const w = (s: Partial<WorkoutSet>) => (s.weight !== undefined ? fmtWeight(s.weight, unit) : '');
  const setW = (t: string) => {
    const n = parseNum(t);
    return { weight: n === undefined ? undefined : fromDisplay(n, unit) };
  };
  const reps = (s: Partial<WorkoutSet>) => (s.reps !== undefined ? String(s.reps) : '');
  const setReps = (t: string) => {
    const n = parseNum(t);
    return { reps: n === undefined ? undefined : Math.round(n) };
  };
  const dUnit = unit === 'kg' ? 'km' : 'mi';
  const dScale = unit === 'kg' ? 1000 : 1609.344;
  switch (ex.kind) {
    case 'time':
      return {
        b: { label: 'Time', get: (s) => fmtClockShort(s.seconds), set: (t) => ({ seconds: parseClock(t, 'sec') }), clock: true },
        complete: (s) => (s.seconds ?? 0) > 0,
        fmt: (s) => (s.seconds ? `${fmtClockShort(s.seconds)}${(s.seconds ?? 0) < 60 ? 's' : ''}` : '—'),
      };
    case 'cardio':
      return {
        a: {
          label: dUnit,
          get: (s) => (s.distance ? fmtNum(s.distance / dScale, 2) : ''),
          set: (t) => {
            const n = parseNum(t);
            return { distance: n === undefined ? undefined : n * dScale };
          },
        },
        b: { label: 'Time', get: (s) => fmtClockShort(s.seconds), set: (t) => ({ seconds: parseClock(t, 'min') }), clock: true },
        complete: (s) => (s.distance ?? 0) > 0 || (s.seconds ?? 0) > 0,
        fmt: (s) => [s.distance ? `${fmtNum(s.distance / dScale, 2)} ${dUnit}` : '', s.seconds ? fmtClockShort(s.seconds) : ''].filter(Boolean).join(' · ') || '—',
      };
    case 'reps':
    case 'assisted': {
      const sign = ex.kind === 'reps' ? '+' : '−';
      return {
        a: { label: `${sign}${unit}`, get: w, set: setW, step: loadStep },
        b: { label: 'Reps', get: reps, set: setReps, step: 1 },
        complete: (s) => (s.reps ?? 0) > 0,
        fmt: (s) => (s.weight ? `${sign}${w(s)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`),
      };
    }
    default:
      return {
        a: { label: unit, get: w, set: setW, step: loadStep },
        b: { label: 'Reps', get: reps, set: setReps, step: 1 },
        complete: (s) => (s.reps ?? 0) > 0 && s.weight !== undefined,
        fmt: (s) => `${w(s) || '0'} × ${s.reps ?? 0}`,
      };
  }
}

// ---------------------------------------------------------------------------

const TYPE_META: Record<SetType, { short: string; label: string; colorKey: 'warmup' | 'drop' | 'failure' | 'text' }> = {
  normal: { short: '', label: 'Working set', colorKey: 'text' },
  warmup: { short: 'W', label: 'Warm-up', colorKey: 'warmup' },
  drop: { short: 'D', label: 'Drop set', colorKey: 'drop' },
  failure: { short: 'F', label: 'To failure', colorKey: 'failure' },
};

/** The k-th set of the same kind in another session. */
function counterpart(sets: WorkoutSet[], index: number, pool: WorkoutSet[] | undefined): WorkoutSet | undefined {
  if (!pool?.length) return undefined;
  const t = sets[index].type;
  const group = (x: SetType) => (x === 'warmup' ? 'w' : x === 'drop' ? 'd' : 'n');
  const k = sets.slice(0, index).filter((s) => group(s.type) === group(t)).length;
  const same = pool.filter((s) => group(s.type) === group(t));
  return same[k];
}

function workingIndex(sets: WorkoutSet[], index: number): number {
  return sets.slice(0, index).filter((s) => s.type === 'normal' || s.type === 'failure').length;
}

export function WorkoutEditor({ workout, onChange, live }: { workout: Workout; onChange: Change; live: boolean }) {
  const workouts = useStore((s) => s.db.workouts);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; id: string } | null>(null);
  const prior = useMemo(
    () => workouts.filter((w) => w.end && w.start < workout.start && w.id !== workout.id),
    [workouts, workout.start, workout.id],
  );

  const addExercises = (ids: string[]) =>
    onChange((w) => ({
      ...w,
      exercises: [...w.exercises, ...ids.map((exerciseId) => ({ id: uid(), exerciseId, sets: [newSet(), newSet(), newSet()] }))],
    }));

  return (
    <View style={{ gap: space(4) }}>
      {workout.exercises.map((we, i) => (
        <ExerciseBlock
          key={we.id}
          we={we}
          index={i}
          workout={workout}
          prior={prior}
          onChange={onChange}
          live={live}
          onReplace={() => setPicker({ mode: 'replace', id: we.id })}
        />
      ))}
      <Button label="Add exercises" icon="plus" kind="secondary" onPress={() => setPicker({ mode: 'add' })} testID="add-exercises" />
      <NumberBar />
      <ExercisePicker
        visible={picker !== null}
        multi={picker?.mode !== 'replace'}
        title={picker?.mode === 'replace' ? 'Replace exercise' : 'Add exercises'}
        onClose={() => setPicker(null)}
        onPick={(ids) => {
          if (picker?.mode === 'replace') {
            const target = picker.id;
            onChange((w) => ({
              ...w,
              exercises: w.exercises.map((x) => (x.id === target ? { ...x, exerciseId: ids[0] } : x)),
            }));
          } else addExercises(ids);
        }}
      />
    </View>
  );
}

function ExerciseBlock({
  we,
  index,
  workout,
  prior,
  onChange,
  live,
  onReplace,
}: {
  we: WorkoutExercise;
  index: number;
  workout: Workout;
  prior: Workout[];
  onChange: Change;
  live: boolean;
  onReplace: () => void;
}) {
  const c = useTheme();
  const nav = useNav();
  const exercises = useStore((s) => s.exercises);
  const settings = useStore((s) => s.db.settings);
  const unit = settings.unit;
  const ex: Exercise =
    exercises.get(we.exerciseId) ?? { id: we.exerciseId, name: 'Unknown exercise', muscle: 'other', secondary: [], equipment: 'other', kind: 'weight' };
  const history: Session[] = useMemo(() => exerciseHistory(prior, ex.id, settings.rpeAdjust), [prior, ex.id, settings.rpeAdjust]);
  const last = history[history.length - 1];
  const coach: Suggestion | null = useMemo(() => (live ? suggest(ex, history, unit) : null), [live, ex, history, unit]);
  const bestE1rm = useMemo(() => Math.max(0, ...history.map((h) => h.bestE1rm ?? 0)), [history]);
  const bestWeight = useMemo(() => Math.max(0, ...history.map((h) => h.topWeight ?? 0)), [history]);
  const cols = columns(ex, unit);
  const [menu, setMenu] = useState(false);
  const [typeFor, setTypeFor] = useState<string | null>(null);
  const [plates, setPlates] = useState<number | null>(null);
  const [notes, setNotes] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

  const supersetGroup = we.superset ? workout.exercises.filter((x) => x.superset === we.superset) : [];
  const lastInSuperset = !we.superset || supersetGroup[supersetGroup.length - 1]?.id === we.id;

  const update = (fn: (we: WorkoutExercise) => WorkoutExercise) =>
    onChange((w) => ({ ...w, exercises: w.exercises.map((x) => (x.id === we.id ? fn(x) : x)) }));
  const updateSet = (id: string, patch: Partial<WorkoutSet>) =>
    update((x) => ({ ...x, sets: x.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const placeholder = (i: number): Partial<WorkoutSet> => {
    const s = we.sets[i];
    const prev = counterpart(we.sets, i, last?.sets);
    if (coach && (s.type === 'normal' || s.type === 'failure') && coach.sets.length) {
      const k = workingIndex(we.sets, i);
      const t: Target = coach.sets[Math.min(k, coach.sets.length - 1)];
      return { weight: t.weight, reps: t.reps, seconds: t.seconds, distance: t.distance };
    }
    // Without a target, the set above you is a better guess than nothing.
    if (!prev && i > 0) {
      const above = we.sets[i - 1];
      return { weight: above.weight, reps: above.reps, seconds: above.seconds, distance: above.distance };
    }
    return prev ?? {};
  };

  const toggle = (s: WorkoutSet, i: number) => {
    if (s.done) {
      updateSet(s.id, { done: false });
      return;
    }
    const ph = placeholder(i);
    const filled: Partial<WorkoutSet> = {
      weight: s.weight ?? ph.weight,
      reps: s.reps ?? ph.reps,
      seconds: s.seconds ?? ph.seconds,
      distance: s.distance ?? ph.distance,
    };
    if (ex.kind === 'reps' || ex.kind === 'assisted') filled.weight = s.weight ?? (ph.weight || undefined);
    if (!cols.complete(filled)) {
      haptic('warning');
      toast(ex.kind === 'weight' ? 'Enter a weight and reps first' : 'Enter the set first', 'info');
      return;
    }
    updateSet(s.id, { ...filled, done: true });
    haptic('success');
    if (!live) return;
    // A live record, announced the moment it happens.
    if (s.type !== 'warmup' && history.length) {
      const est = e1rm(filled.weight ?? 0, filled.reps ?? 0, settings.rpeAdjust ? s.rpe : undefined) ?? 0;
      const doneOthers = we.sets.filter((x) => x.done && x.type !== 'warmup' && x.id !== s.id);
      const beatToday = doneOthers.every((x) => (e1rm(x.weight ?? 0, x.reps ?? 0) ?? 0) < est);
      if ((filled.weight ?? 0) > bestWeight + 1e-6 && ex.kind === 'weight' && doneOthers.every((x) => (x.weight ?? 0) < (filled.weight ?? 0))) {
        toast(`New heaviest ${ex.name.split(' (')[0]}: ${fmtWeight(filled.weight, unit)} ${unit}`, 'trophy');
      } else if (est > bestE1rm + 1e-6 && beatToday && ex.kind === 'weight') {
        toast(`New estimated 1RM: ${fmtEst(est, unit)} ${unit}`, 'trophy');
      }
    }
    const rest = we.restSec ?? settings.restSec;
    if (lastInSuperset && rest > 0) startRest(rest, ex.name);
  };

  const isPr = (s: WorkoutSet) => {
    if (!s.done || s.type === 'warmup' || !history.length || ex.kind !== 'weight') return false;
    const est = e1rm(s.weight ?? 0, s.reps ?? 0) ?? 0;
    return est > bestE1rm + 1e-6 || (s.weight ?? 0) > bestWeight + 1e-6;
  };

  const addWarmups = () => {
    const firstWork = we.sets.findIndex((s) => s.type === 'normal' || s.type === 'failure');
    const working = firstWork >= 0 ? we.sets[firstWork].weight ?? placeholder(firstWork).weight : undefined;
    if (!working) {
      toast('Set a working weight first', 'info');
      return;
    }
    const bar = toDisplay(settings.barKg, unit);
    const usesBar = ['barbell', 'smith', 'ez bar', 'trap bar'].includes(ex.equipment);
    const ramp = warmupRamp(toDisplay(working, unit), bar, settings.plates, usesBar);
    if (!ramp.length) {
      toast('Too light to need a warm-up', 'info');
      return;
    }
    update((x) => ({
      ...x,
      sets: [
        ...ramp.map((r) => ({ ...newSet('warmup'), weight: fromDisplay(r.weight, unit), reps: r.reps })),
        ...x.sets.filter((s) => !(s.type === 'warmup' && !s.done)),
      ],
    }));
  };

  const move = (dir: -1 | 1) =>
    onChange((w) => {
      const list = [...w.exercises];
      const j = index + dir;
      if (j < 0 || j >= list.length) return w;
      [list[index], list[j]] = [list[j], list[index]];
      return { ...w, exercises: list };
    });

  const toggleSuperset = () =>
    onChange((w) => {
      const list = [...w.exercises];
      const me = list[index];
      if (me.superset) {
        const id = me.superset;
        const remaining = list.filter((x) => x.superset === id && x.id !== me.id);
        return {
          ...w,
          exercises: list.map((x) => {
            if (x.id === me.id) return { ...x, superset: undefined };
            if (x.superset === id && remaining.length < 2) return { ...x, superset: undefined };
            return x;
          }),
        };
      }
      const next = list[index + 1];
      if (!next) return w;
      const id = next.superset ?? uid();
      list[index] = { ...me, superset: id };
      list[index + 1] = { ...next, superset: id };
      return { ...w, exercises: list };
    });

  const remove = () => onChange((w) => ({ ...w, exercises: w.exercises.filter((x) => x.id !== we.id) }));

  const restLabel = we.restSec !== undefined ? (we.restSec ? fmtClockShort(we.restSec) : 'off') : null;
  const doneCount = we.sets.filter((s) => s.done).length;

  return (
    <View
      style={[
        styles.block,
        { backgroundColor: c.surface, borderColor: c.border },
        we.superset ? { borderLeftWidth: 4, borderLeftColor: c.info } : null,
      ]}
      testID={`block-${index}`}
    >
      <View style={styles.blockHead}>
        <Pressable style={{ flex: 1 }} onPress={() => nav.push({ name: 'exercise', id: ex.id })}>
          {we.superset ? (
            <T v="label" color={c.info}>
              Superset
            </T>
          ) : null}
          <T v="heading" color={c.accent} numberOfLines={2}>
            {ex.name}
          </T>
        </Pressable>
        {restLabel ? <Chip label={restLabel} icon="timer" /> : null}
        <IconButton name="more" label={`Options for ${ex.name}`} onPress={() => setMenu(true)} bg={c.surfaceAlt} size={18} />
      </View>

      {we.notes ? (
        <Pressable onPress={() => setNotes(true)}>
          <T v="small" dim style={{ fontStyle: 'italic', marginBottom: space(2) }}>
            {we.notes}
          </T>
        </Pressable>
      ) : null}

      {coach && coach.action !== 'first' ? (
        <Pressable onPress={() => setShowCoach((v) => !v)} style={[styles.coach, { backgroundColor: coach.action === 'deload' ? c.goldSoft : c.accentSoft }]}>
          <Icon name={coach.action === 'deload' ? 'info' : coach.action === 'increase' ? 'up' : 'target'} size={16} color={coach.action === 'deload' ? c.gold : c.accent} strokeWidth={2.4} />
          <View style={{ flex: 1 }}>
            <T v="smallStrong" color={coach.action === 'deload' ? c.gold : c.accent}>
              {coach.headline}
            </T>
            {showCoach ? (
              <T v="small" dim style={{ marginTop: 2 }}>
                {coach.detail}
              </T>
            ) : null}
          </View>
          <Icon name={showCoach ? 'up' : 'down'} size={14} color={c.textFaint} />
        </Pressable>
      ) : coach?.action === 'first' ? (
        <View style={[styles.coach, { backgroundColor: c.surfaceAlt }]}>
          <Icon name="target" size={16} color={c.textDim} />
          <T v="small" dim style={{ flex: 1 }}>
            {coach.detail}
          </T>
        </View>
      ) : null}

      <View style={styles.colHead}>
        <T v="label" faint style={styles.cSet}>
          Set
        </T>
        <T v="label" faint style={styles.cPrev}>
          Previous
        </T>
        {cols.a ? (
          <T v="label" faint style={styles.cIn} center>
            {cols.a.label}
          </T>
        ) : null}
        <T v="label" faint style={styles.cIn} center>
          {cols.b.label}
        </T>
        <View style={styles.cCheck} />
      </View>

      {we.sets.map((s, i) => {
        const prev = counterpart(we.sets, i, last?.sets);
        const ph = placeholder(i);
        const meta = TYPE_META[s.type];
        const n = s.type === 'normal' || s.type === 'failure' ? workingIndex(we.sets, i) + 1 : 0;
        const pr = isPr(s);
        return (
          <View key={s.id} style={[styles.setRow, s.done && { backgroundColor: c.done }]} testID={`set-${index}-${i}`}>
            <Pressable
              style={[styles.cSet, styles.setNum]}
              onPress={() => setTypeFor(s.id)}
              accessibilityLabel={`Set ${i + 1}, ${meta.label}. Change type`}
            >
              <T v="bodyStrong" color={meta.colorKey === 'text' ? c.text : c[meta.colorKey]}>
                {s.type === 'failure' ? `${n}F` : meta.short || String(n)}
              </T>
              {s.rpe ? (
                <T v="caption" faint style={{ fontSize: 9, lineHeight: 10, marginTop: -2 }}>
                  @{fmtNum(s.rpe, 1)}
                </T>
              ) : null}
            </Pressable>
            <Pressable
              style={styles.cPrev}
              onPress={() => prev && !s.done && updateSet(s.id, { weight: prev.weight, reps: prev.reps, seconds: prev.seconds, distance: prev.distance })}
            >
              <T v="small" faint numberOfLines={1} style={tabular}>
                {prev ? cols.fmt(prev) : '—'}
              </T>
            </Pressable>
            {cols.a ? (
              <View style={styles.cIn}>
                <NumInput
                  testID={`in-a-${index}-${i}`}
                  value={cols.a.get(s)}
                  placeholder={cols.a.get(ph)}
                  done={s.done}
                  step={cols.a.step}
                  onCommit={(t) => updateSet(s.id, cols.a!.set(t))}
                />
              </View>
            ) : null}
            <View style={styles.cIn}>
              <NumInput
                testID={`in-b-${index}-${i}`}
                value={cols.b.get(s)}
                placeholder={cols.b.get(ph)}
                done={s.done}
                clock={cols.b.clock}
                step={cols.b.step}
                onCommit={(t) => updateSet(s.id, cols.b.set(t))}
              />
            </View>
            <Pressable
              testID={`check-${index}-${i}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              accessibilityLabel={`Complete set ${i + 1}`}
              onPress={() => toggle(s, i)}
              style={[styles.cCheck, styles.check, { backgroundColor: s.done ? (pr ? c.gold : c.accent) : c.raised }]}
            >
              <Icon name={pr ? 'trophy' : 'check'} size={18} color={s.done ? c.accentText : c.textFaint} strokeWidth={2.6} />
            </Pressable>
          </View>
        );
      })}

      <View style={styles.blockFoot}>
        <Pressable
          testID={`add-set-${index}`}
          onPress={() => {
            haptic();
            update((x) => ({ ...x, sets: [...x.sets, newSet()] }));
          }}
          style={({ pressed }) => [styles.addSet, { backgroundColor: c.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="plus" size={16} color={c.text} strokeWidth={2.4} />
          <T v="smallStrong">Add set</T>
        </Pressable>
        {live && doneCount > 0 && doneCount === we.sets.length ? (
          <Icon name="check" size={18} color={c.accent} strokeWidth={2.6} />
        ) : null}
      </View>

      {/* Set type */}
      <Sheet visible={typeFor !== null} onClose={() => setTypeFor(null)} title="Set">
        <SheetScroll>
          {(['warmup', 'normal', 'drop', 'failure'] as SetType[]).map((t) => (
            <MenuRow
              key={t}
              icon={t === 'warmup' ? 'flame' : t === 'drop' ? 'down' : t === 'failure' ? 'bolt' : 'dumbbell'}
              label={TYPE_META[t].label}
              color={TYPE_META[t].colorKey === 'text' ? undefined : c[TYPE_META[t].colorKey]}
              onPress={() => {
                if (typeFor) updateSet(typeFor, { type: t });
                setTypeFor(null);
              }}
            />
          ))}
          {ex.kind === 'weight' || ex.kind === 'reps' || ex.kind === 'assisted' ? (
            <>
              <T v="label" dim style={{ marginTop: space(2) }}>
                Effort (RPE)
              </T>
              <T v="caption" faint>
                10 is all-out; 8 means two more reps were left. Counted in your 1RM estimates.
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
                {[undefined, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
                  <Chip
                    key={String(v)}
                    label={v === undefined ? 'None' : fmtNum(v, 1)}
                    active={we.sets.find((x) => x.id === typeFor)?.rpe === v}
                    onPress={() => typeFor && updateSet(typeFor, { rpe: v })}
                  />
                ))}
              </View>
            </>
          ) : null}
          <MenuRow
            icon="trash"
            label="Delete set"
            danger
            onPress={() => {
              const id = typeFor;
              setTypeFor(null);
              update((x) => ({ ...x, sets: x.sets.filter((s) => s.id !== id) }));
            }}
          />
        </SheetScroll>
      </Sheet>

      {/* Exercise menu */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={ex.name}>
        <SheetScroll>
          <MenuRow icon="flame" label="Add warm-up sets" sub="A ramp to your first working set" onPress={() => (setMenu(false), addWarmups())} />
          {ex.kind === 'weight' && ['barbell', 'smith', 'ez bar', 'trap bar', 'machine'].includes(ex.equipment) && (
            <MenuRow
              icon="calc"
              label="Plate calculator"
              onPress={() => {
                setMenu(false);
                const firstWork = we.sets.findIndex((s) => s.type !== 'warmup');
                const kg = firstWork >= 0 ? we.sets[firstWork].weight ?? placeholder(firstWork).weight ?? 0 : 0;
                afterModal(() => setPlates(kg));
              }}
            />
          )}
          <T v="label" dim style={{ marginTop: space(2) }}>
            Rest after each set
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {[undefined, 0, 30, 60, 90, 120, 180, 240, 300].map((v) => (
              <Chip
                key={String(v)}
                label={v === undefined ? `Default (${fmtClockShort(settings.restSec) || 'off'})` : v === 0 ? 'Off' : fmtClockShort(v)}
                active={we.restSec === v}
                onPress={() => update((x) => ({ ...x, restSec: v }))}
              />
            ))}
          </View>
          <MenuRow icon="note" label={we.notes ? 'Edit note' : 'Add note'} onPress={() => (setMenu(false), afterModal(() => setNotes(true)))} />
          {(we.superset || index < workout.exercises.length - 1) && (
            <MenuRow
              icon="link"
              label={we.superset ? 'Remove from superset' : 'Superset with next exercise'}
              onPress={() => (setMenu(false), toggleSuperset())}
            />
          )}
          <MenuRow icon="swap" label="Replace exercise" onPress={() => (setMenu(false), afterModal(onReplace))} />
          {index > 0 && <MenuRow icon="up" label="Move up" onPress={() => (setMenu(false), move(-1))} />}
          {index < workout.exercises.length - 1 && <MenuRow icon="down" label="Move down" onPress={() => (setMenu(false), move(1))} />}
          <MenuRow icon="trash" label="Remove exercise" danger onPress={() => (setMenu(false), remove())} />
        </SheetScroll>
      </Sheet>

      <Sheet visible={plates !== null} onClose={() => setPlates(null)} title="Plate calculator">
        <SheetScroll>{plates !== null ? <PlateCalculator initialKg={plates || undefined} /> : null}</SheetScroll>
      </Sheet>

      <NotesSheet visible={notes} initial={we.notes ?? ''} onClose={() => setNotes(false)} onSave={(t) => update((x) => ({ ...x, notes: t || undefined }))} />
    </View>
  );
}

export function NotesSheet({ visible, initial, onClose, onSave, title = 'Note' }: { visible: boolean; initial: string; onClose: () => void; onSave: (t: string) => void; title?: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <SheetScroll>
        <Field value={text} onChangeText={setText} multiline placeholder="Seat height, grip, how it felt…" style={{ minHeight: 100, textAlignVertical: 'top' }} autoFocus />
        <Button
          label="Save"
          onPress={() => {
            onSave(text.trim());
            onClose();
          }}
        />
      </SheetScroll>
    </Sheet>
  );
}

export function MenuRow({ icon, label, sub, onPress, danger, color }: { icon: IconName; label: string; sub?: string; onPress: () => void; danger?: boolean; color?: string }) {
  const c = useTheme();
  const fg = danger ? c.danger : color ?? c.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? c.dangerSoft : c.surfaceAlt }]}>
        <Icon name={icon} size={18} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" color={fg}>
          {label}
        </T>
        {sub ? (
          <T v="small" dim>
            {sub}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space(3), paddingTop: space(3), paddingBottom: space(2) },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(2) },
  coach: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(2.5), borderRadius: radius.md, marginBottom: space(2) },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(1), paddingBottom: space(1) },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(1), paddingVertical: space(1), borderRadius: radius.sm },
  cSet: { width: 30 },
  setNum: { height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  cPrev: { flex: 1.25, minWidth: 0 },
  cIn: { flex: 1, minWidth: 0 },
  cCheck: { width: 40 },
  check: { height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  input: { height: 36, borderRadius: radius.sm, textAlign: 'center', fontSize: 17, fontWeight: '700', paddingHorizontal: 2 },
  blockFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(2) },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.md, flex: 1, justifyContent: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(2), borderTopWidth: StyleSheet.hairlineWidth },
  barKey: { minWidth: 56, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(3) },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
