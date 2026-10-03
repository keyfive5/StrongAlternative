// A finished workout: the post-workout summary, the history detail view, and
// editing it after the fact.

import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { e1rm, isWorking, workoutPrs, workoutSetCount, workoutVolume, type PrHit } from '../../core/analytics.ts';
import type { Exercise, Unit, Workout } from '../../core/types.ts';
import { fmtBig, fmtDuration, fmtEst, fmtNum, fmtWeight, toDisplay } from '../../core/units.ts';
import {
  deleteWorkout,
  mergeRoutine,
  routineFromWorkout,
  saveRoutine,
  saveWorkout,
  startWorkout,
  useStore,
} from '../../state/store.ts';
import { Icon } from '../Icon.tsx';
import { Button, Card, confirm, IconButton, SectionLabel, Stat, T, toast } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { Body, Header } from '../Screen.tsx';
import { WorkoutEditor } from '../WorkoutEditor.tsx';
import { fmtDate, fmtTime, radius, space, tabular, useTheme } from '../theme.ts';

export function prLabel(pr: PrHit, unit: Unit): string {
  const w = (kg: number) => `${fmtWeight(kg, unit)} ${unit}`;
  switch (pr.kind) {
    case 'e1rm':
      return `Est. 1RM ${fmtEst(pr.value, unit)} ${unit}`;
    case 'weight':
      return `Heaviest ${w(pr.value)}`;
    case 'volume':
      return `Volume ${fmtBig(toDisplay(pr.value, unit))} ${unit}`;
    case 'reps':
      return `${pr.value} reps`;
    case 'repmax':
      return `${pr.reps}-rep max ${w(pr.value)}`;
    case 'time':
      return `Longest ${pr.value}s`;
    case 'distance':
      return `Farthest ${fmtNum(pr.value / 1000, 2)} km`;
  }
}

function setText(s: { weight?: number; reps?: number; seconds?: number; distance?: number; type: string }, ex: Exercise | undefined, unit: Unit): string {
  if (ex?.kind === 'time') return `${s.seconds ?? 0}s`;
  if (ex?.kind === 'cardio') {
    const d = s.distance ? `${fmtNum(s.distance / (unit === 'kg' ? 1000 : 1609.344), 2)} ${unit === 'kg' ? 'km' : 'mi'}` : '';
    const t = s.seconds ? fmtDuration(s.seconds) : '';
    return [d, t].filter(Boolean).join(' · ');
  }
  if ((ex?.kind === 'reps' || ex?.kind === 'assisted') && !s.weight) return `${s.reps ?? 0} reps`;
  const sign = ex?.kind === 'assisted' ? '−' : ex?.kind === 'reps' ? '+' : '';
  return `${sign}${fmtWeight(s.weight ?? 0, unit)} ${unit} × ${s.reps ?? 0}`;
}

function WorkoutBody({ w, prs }: { w: Workout; prs: PrHit[] }) {
  const c = useTheme();
  const nav = useNav();
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.db.settings.unit);
  return (
    <View style={{ gap: space(3) }}>
      {w.notes ? (
        <T dim style={{ fontStyle: 'italic' }}>
          {w.notes}
        </T>
      ) : null}
      {w.exercises.map((we) => {
        const ex = exercises.get(we.exerciseId);
        const best = we.sets.filter(isWorking).reduce<{ id?: string; v: number }>((b, s) => {
          const v = e1rm(s.weight ?? 0, s.reps ?? 0) ?? 0;
          return v > b.v ? { id: s.id, v } : b;
        }, { v: 0 });
        const exPrs = prs.filter((p) => p.exerciseId === we.exerciseId);
        let n = 0;
        return (
          <Card key={we.id} onPress={() => nav.push({ name: 'exercise', id: we.exerciseId })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <T v="heading" color={c.accent} style={{ flex: 1 }} numberOfLines={2}>
                {ex?.name ?? 'Unknown exercise'}
              </T>
              {exPrs.length ? <Icon name="trophy" size={18} color={c.gold} /> : null}
            </View>
            {we.notes ? (
              <T v="small" dim style={{ fontStyle: 'italic', marginTop: 2 }}>
                {we.notes}
              </T>
            ) : null}
            <View style={{ marginTop: space(2), gap: space(1) }}>
              {we.sets.map((s) => {
                const label = s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? `${++n}F` : String(++n);
                const color = s.type === 'warmup' ? c.warmup : s.type === 'drop' ? c.drop : s.type === 'failure' ? c.failure : c.textDim;
                return (
                  <View key={s.id} style={styles.setLine}>
                    <T v="smallStrong" color={color} style={{ width: 30 }}>
                      {label}
                    </T>
                    <T v="body" style={[{ flex: 1 }, tabular]}>
                      {setText(s, ex, unit)}
                      {s.rpe ? <T v="small" dim>{`  @${s.rpe}`}</T> : null}
                    </T>
                    {best.id === s.id && ex?.kind === 'weight' ? (
                      <T v="caption" faint style={tabular}>
                        1RM {fmtEst(best.v, unit)}
                      </T>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {exPrs.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2) }}>
                {exPrs.map((p, i) => (
                  <View key={i} style={[styles.prPill, { backgroundColor: c.goldSoft }]}>
                    <T v="caption" color={c.gold}>
                      {prLabel(p, unit)}
                    </T>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

function StatsCard({ w, prCount }: { w: Workout; prCount: number }) {
  const unit = useStore((s) => s.db.settings.unit);
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <Stat label="Time" value={fmtDuration(((w.end ?? w.start) - w.start) / 1000)} />
        <Stat label="Volume" value={fmtBig(toDisplay(workoutVolume(w), unit))} sub={unit} />
        <Stat label="Sets" value={String(workoutSetCount(w))} />
        <Stat label="Records" value={String(prCount)} accent={prCount > 0} />
      </View>
    </Card>
  );
}

export function SummaryScreen({ id }: { id: string }) {
  const c = useTheme();
  const nav = useNav();
  const workouts = useStore((s) => s.db.workouts);
  const routines = useStore((s) => s.db.routines);
  const settings = useStore((s) => s.db.settings);
  const w = workouts.find((x) => x.id === id);
  const prs = useMemo(() => (w ? workoutPrs(w, workouts, settings.rpeAdjust) : []), [w, workouts, settings.rpeAdjust]);
  const [savedRoutine, setSavedRoutine] = useState(false);
  if (!w) return null;
  const routine = routines.find((r) => r.id === w.routineId);
  const merged = routine ? mergeRoutine(routine, w) : null;
  const finishedCount = workouts.filter((x) => x.end).length;
  const headline = prs.length ? `${prs.length} new record${prs.length > 1 ? 's' : ''}` : 'Workout complete';

  return (
    <View style={{ flex: 1 }}>
      <Header title="" right={<Button label="Done" small onPress={nav.pop} testID="summary-done" />} />
      <Body>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: prs.length ? c.goldSoft : c.accentSoft }]}>
            <Icon name={prs.length ? 'trophy' : 'check'} size={34} color={prs.length ? c.gold : c.accent} strokeWidth={2.4} />
          </View>
          <T v="display" center>
            {headline}
          </T>
          <T dim center>
            {w.name} · workout #{finishedCount}
          </T>
        </View>
        <StatsCard w={w} prCount={prs.length} />
        {routine && merged && !savedRoutine ? (
          <Card style={{ marginTop: space(3), backgroundColor: c.surfaceAlt }}>
            <T v="bodyStrong">Update “{routine.name}”?</T>
            <T v="small" dim style={{ marginTop: 2 }}>
              Today’s set counts and any exercises you added become part of the routine. Exercises you skipped stay in it.
            </T>
            <Button
              label="Update routine"
              kind="secondary"
              small
              style={{ marginTop: space(3), alignSelf: 'flex-start' }}
              onPress={() => {
                saveRoutine(merged);
                setSavedRoutine(true);
                toast('Routine updated', 'check');
              }}
            />
          </Card>
        ) : !routine && !savedRoutine ? (
          <Card style={{ marginTop: space(3), backgroundColor: c.surfaceAlt }}>
            <T v="bodyStrong">Save as a routine?</T>
            <T v="small" dim style={{ marginTop: 2 }}>
              Start this exact workout again in one tap.
            </T>
            <Button
              label="Save as routine"
              kind="secondary"
              small
              style={{ marginTop: space(3), alignSelf: 'flex-start' }}
              onPress={() => {
                saveRoutine(routineFromWorkout(w));
                setSavedRoutine(true);
                toast('Saved to your routines', 'check');
              }}
            />
          </Card>
        ) : null}
        <SectionLabel>Exercises</SectionLabel>
        <WorkoutBody w={w} prs={prs} />
      </Body>
    </View>
  );
}

export function WorkoutDetailScreen({ id }: { id: string }) {
  const c = useTheme();
  const nav = useNav();
  const workouts = useStore((s) => s.db.workouts);
  const active = useStore((s) => s.active);
  const settings = useStore((s) => s.db.settings);
  const w = workouts.find((x) => x.id === id);
  const prs = useMemo(() => (w ? workoutPrs(w, workouts, settings.rpeAdjust) : []), [w, workouts, settings.rpeAdjust]);
  if (!w) return null;
  return (
    <View style={{ flex: 1 }}>
      <Header
        title={w.name}
        subtitle={`${fmtDate(w.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtTime(w.start)}`}
        back
        right={<IconButton name="edit" label="Edit workout" onPress={() => nav.push({ name: 'editWorkout', id })} bg={c.surfaceAlt} />}
      />
      <Body>
        <StatsCard w={w} prCount={prs.length} />
        <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(3) }}>
          <Button
            label="Repeat"
            icon="play"
            style={{ flex: 1 }}
            disabled={!!active}
            onPress={() => {
              startWorkout({ ...routineFromWorkout(w), id: w.routineId ?? '' });
              nav.openWorkout();
            }}
          />
          <Button
            label="Save as routine"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              saveRoutine(routineFromWorkout(w));
              toast('Saved to your routines', 'check');
            }}
          />
        </View>
        <SectionLabel>Exercises</SectionLabel>
        <WorkoutBody w={w} prs={prs} />
        <Button
          label="Delete workout"
          kind="danger"
          style={{ marginTop: space(6) }}
          onPress={() =>
            confirm('Delete this workout?', 'It will be removed from your history, charts and records.', 'Delete', () => {
              deleteWorkout(id);
              nav.pop();
            })
          }
        />
      </Body>
    </View>
  );
}

export function EditWorkoutScreen({ id }: { id: string }) {
  const c = useTheme();
  const nav = useNav();
  const original = useStore((s) => s.db.workouts.find((x) => x.id === id));
  const [draft, setDraft] = useState<Workout | undefined>(original);
  const [minutes, setMinutes] = useState(original ? String(Math.round(((original.end ?? original.start) - original.start) / 60000)) : '');
  if (!draft) return null;
  const save = () => {
    const mins = Math.max(1, parseInt(minutes, 10) || 1);
    const exercises = draft.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);
    saveWorkout({ ...draft, exercises, end: draft.start + mins * 60000 });
    toast('Workout saved', 'check');
    nav.pop();
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="Edit workout" back right={<Button label="Save" small onPress={save} testID="save-edit" />} />
      <Body>
        <TextInput
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          style={[styles.name, { color: c.text }]}
          placeholder="Workout name"
          placeholderTextColor={c.textFaint}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(4) }}>
          <T dim v="small">
            {fmtDate(draft.start, { day: 'numeric', month: 'short', year: 'numeric' })} · lasted
          </T>
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            style={[styles.minutes, { color: c.text, backgroundColor: c.surfaceAlt }]}
          />
          <T dim v="small">
            min
          </T>
        </View>
        <T v="small" faint style={{ marginBottom: space(3) }}>
          Only ticked sets are kept when you save.
        </T>
        <WorkoutEditor workout={draft} onChange={(fn) => setDraft((d) => (d ? fn(d) : d))} live={false} />
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space(2), paddingVertical: space(6) },
  heroIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  setLine: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  prPill: { paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, paddingVertical: space(1) },
  minutes: { width: 64, textAlign: 'center', fontSize: 15, fontWeight: '700', paddingVertical: space(1.5), borderRadius: radius.sm },
});
