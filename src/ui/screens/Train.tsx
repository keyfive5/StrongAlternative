// Train: start a workout, keep routines, add a starter programme.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { PROGRAMS, programRoutines } from '../../core/templates.ts';
import type { Routine, RoutineExercise } from '../../core/types.ts';
import { uid } from '../../core/types.ts';
import { relativeDay } from '../theme.ts';
import {
  deleteRoutine,
  duplicateRoutine,
  saveRoutine,
  startWorkout,
  useStore,
} from '../../state/store.ts';
import { Icon } from '../Icon.tsx';
import { afterModal, ask, Button, Card, confirm, IconButton, SectionLabel, Sheet, SheetScroll, T, toast } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { ExercisePicker } from '../pickers.tsx';
import { Body, Header } from '../Screen.tsx';
import { MenuRow } from '../WorkoutEditor.tsx';
import { radius, space, useTheme } from '../theme.ts';

export function TrainScreen() {
  const c = useTheme();
  const nav = useNav();
  const routines = useStore((s) => s.db.routines);
  const workouts = useStore((s) => s.db.workouts);
  const exercises = useStore((s) => s.exercises);
  const active = useStore((s) => s.active);
  const [menuFor, setMenuFor] = useState<Routine | null>(null);
  const [programs, setPrograms] = useState(false);

  const lastDone = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts) if (w.routineId && w.end) m.set(w.routineId, Math.max(m.get(w.routineId) ?? 0, w.start));
    return m;
  }, [workouts]);

  const groups = useMemo(() => {
    const m = new Map<string, Routine[]>();
    for (const r of routines) {
      const k = r.folder ?? 'My routines';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [routines]);

  const start = (r?: Routine) => {
    if (active) {
      ask('A workout is already running', 'Finish or cancel it before starting another.', [
        { label: 'Go to workout', kind: 'primary', onPress: nav.openWorkout },
        { label: 'OK', kind: 'cancel' },
      ]);
      return;
    }
    startWorkout(r);
    nav.openWorkout();
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Train" />
      <Body>
        <Button label="Start an empty workout" icon="play" onPress={() => start()} testID="train-start-empty" />
        <SectionLabel
          right={
            <Pressable onPress={() => nav.push({ name: 'routine' })} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} testID="new-routine">
              <Icon name="plus" size={16} color={c.accent} strokeWidth={2.4} />
              <T v="smallStrong" color={c.accent}>
                New routine
              </T>
            </Pressable>
          }
        >
          Routines · no limit
        </SectionLabel>
        {routines.length === 0 ? (
          <Card style={{ backgroundColor: c.surfaceAlt }}>
            <T v="bodyStrong">No routines yet</T>
            <T v="small" dim style={{ marginTop: 2 }}>
              Build your own, save one from any finished workout, or start from a proven programme.
            </T>
            <Button label="Browse programmes" kind="secondary" small style={{ marginTop: space(3), alignSelf: 'flex-start' }} onPress={() => setPrograms(true)} />
          </Card>
        ) : (
          groups.map(([folder, list]) => (
            <View key={folder} style={{ gap: space(3), marginBottom: space(3) }}>
              {groups.length > 1 || folder !== 'My routines' ? (
                <T v="smallStrong" dim style={{ marginLeft: space(1) }}>
                  {folder}
                </T>
              ) : null}
              {list.map((r) => {
                const last = lastDone.get(r.id);
                return (
                  <Card key={r.id} onPress={() => start(r)} testID={`routine-${r.name}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <T v="heading" style={{ flex: 1 }} numberOfLines={1}>
                        {r.name}
                      </T>
                      <IconButton name="more" label={`Options for ${r.name}`} onPress={() => setMenuFor(r)} size={18} />
                    </View>
                    <T v="small" dim numberOfLines={2} style={{ marginTop: 2 }}>
                      {r.exercises.map((e) => exercises.get(e.exerciseId)?.name.replace(/ \(.*\)$/, '') ?? '?').join(', ') || 'No exercises'}
                    </T>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(2) }}>
                      <Icon name="play" size={12} color={c.accent} />
                      <T v="caption" color={c.accent}>
                        Start
                      </T>
                      <T v="caption" faint style={{ marginLeft: 'auto' }}>
                        {last ? `Last done ${relativeDay(last).toLowerCase()}` : 'Not done yet'}
                      </T>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))
        )}
        {routines.length > 0 && <Button label="Browse programmes" kind="ghost" onPress={() => setPrograms(true)} />}
      </Body>

      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        <SheetScroll>
          <MenuRow icon="play" label="Start" onPress={() => (setMenuFor(null), start(menuFor!))} />
          <MenuRow icon="edit" label="Edit" onPress={() => (setMenuFor(null), nav.push({ name: 'routine', id: menuFor!.id }))} />
          <MenuRow icon="copy" label="Duplicate" onPress={() => (setMenuFor(null), duplicateRoutine(menuFor!.id))} />
          <MenuRow
            icon="trash"
            label="Delete"
            danger
            onPress={() => {
              const r = menuFor!;
              setMenuFor(null);
              afterModal(() => confirm(`Delete “${r.name}”?`, 'Workouts you did from it stay in your history.', 'Delete', () => deleteRoutine(r.id)));
            }}
          />
        </SheetScroll>
      </Sheet>

      <Sheet visible={programs} onClose={() => setPrograms(false)} title="Programmes" full>
        <SheetScroll>
          <T v="small" dim>
            Adds the programme’s days to your routines. The coach sets your weights from your own history as you go.
          </T>
          {PROGRAMS.map((p) => (
            <Card key={p.name} style={{ backgroundColor: c.surfaceAlt }}>
              <T v="heading">{p.name}</T>
              <T v="small" dim style={{ marginTop: 2 }}>
                {p.blurb}
              </T>
              {p.days.map((d) => (
                <T key={d.name} v="small" style={{ marginTop: space(2) }}>
                  <T v="smallStrong">{d.name}: </T>
                  <T v="small" dim>
                    {d.exercises.map(([id]) => exercises.get(id)?.name.replace(/ \(.*\)$/, '') ?? id).join(', ')}
                  </T>
                </T>
              ))}
              <Button
                label="Add to my routines"
                small
                style={{ marginTop: space(3), alignSelf: 'flex-start' }}
                onPress={() => {
                  for (const r of programRoutines(p)) saveRoutine(r);
                  setPrograms(false);
                  toast(`${p.name} added`, 'check');
                }}
              />
            </Card>
          ))}
        </SheetScroll>
      </Sheet>
    </View>
  );
}

export function RoutineEditorScreen({ id }: { id?: string }) {
  const c = useTheme();
  const nav = useNav();
  const existing = useStore((s) => s.db.routines.find((r) => r.id === id));
  const exercises = useStore((s) => s.exercises);
  const [draft, setDraft] = useState<Routine>(existing ?? { id: uid(), name: '', exercises: [], updated: Date.now() });
  const [picker, setPicker] = useState(false);

  const updateEx = (i: number, patch: Partial<RoutineExercise>) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const save = () => {
    if (!draft.exercises.length) {
      toast('Add at least one exercise', 'info');
      return;
    }
    saveRoutine({ ...draft, name: draft.name.trim() || 'New routine' });
    toast('Routine saved', 'check');
    nav.pop();
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={existing ? 'Edit routine' : 'New routine'} back right={<Button label="Save" small onPress={save} testID="save-routine" />} />
      <Body>
        <TextInput
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder="Routine name"
          placeholderTextColor={c.textFaint}
          style={[styles.name, { color: c.text }]}
          autoFocus={!existing}
          testID="routine-name"
        />
        <View style={{ gap: space(3), marginTop: space(3) }}>
          {draft.exercises.map((re, i) => {
            const ex = exercises.get(re.exerciseId);
            return (
              <Card key={i}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <T v="heading" color={c.accent} style={{ flex: 1 }} numberOfLines={2}>
                    {ex?.name ?? re.exerciseId}
                  </T>
                  {i > 0 && (
                    <IconButton
                      name="up"
                      label="Move up"
                      size={18}
                      onPress={() =>
                        setDraft((d) => {
                          const list = [...d.exercises];
                          [list[i - 1], list[i]] = [list[i], list[i - 1]];
                          return { ...d, exercises: list };
                        })
                      }
                    />
                  )}
                  <IconButton
                    name="trash"
                    label="Remove"
                    size={18}
                    color={c.danger}
                    onPress={() => setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}
                  />
                </View>
                <View style={styles.stepper}>
                  <T dim style={{ flex: 1 }}>
                    Sets
                  </T>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: c.surfaceAlt }]}
                    onPress={() => re.sets.length > 1 && updateEx(i, { sets: re.sets.slice(0, -1) })}
                    accessibilityLabel="One fewer set"
                  >
                    <Icon name="minus" size={16} color={c.text} />
                  </Pressable>
                  <T v="title" style={{ width: 36, textAlign: 'center' }}>
                    {re.sets.length}
                  </T>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: c.surfaceAlt }]}
                    onPress={() => updateEx(i, { sets: [...re.sets, { type: 'normal' }] })}
                    accessibilityLabel="One more set"
                  >
                    <Icon name="plus" size={16} color={c.text} />
                  </Pressable>
                </View>
                {ex && (ex.repMin || ex.kind === 'weight') ? (
                  <T v="caption" faint>
                    Targets come from the coach and your last session. Rep range is set per exercise.
                  </T>
                ) : null}
              </Card>
            );
          })}
        </View>
        <Button label="Add exercises" icon="plus" kind="secondary" style={{ marginTop: space(4) }} onPress={() => setPicker(true)} testID="routine-add" />
        {existing ? (
          <Button
            label="Delete routine"
            kind="danger"
            style={{ marginTop: space(6) }}
            onPress={() =>
              confirm(`Delete “${existing.name}”?`, 'Workouts you did from it stay in your history.', 'Delete', () => {
                deleteRoutine(existing.id);
                nav.pop();
              })
            }
          />
        ) : null}
      </Body>
      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(ids) =>
          setDraft((d) => ({
            ...d,
            exercises: [...d.exercises, ...ids.map((exerciseId) => ({ exerciseId, sets: [{ type: 'normal' as const }, { type: 'normal' as const }, { type: 'normal' as const }] }))],
          }))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, paddingVertical: space(1) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginVertical: space(2) },
  stepBtn: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
