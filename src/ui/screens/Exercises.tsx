// The exercise library, and one exercise in depth: coach, charts, records, history.

import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { exerciseHistory, isWorking, records, trendPerMonth, weightForReps } from '../../core/analytics.ts';
import { incrementKg, repRange, suggest } from '../../core/coach.ts';
import { equipmentLabel } from '../../core/library.ts';
import type { Muscle } from '../../core/types.ts';
import { fmtBig, fmtDuration, fmtEst, fmtNum, fmtWeight, fromDisplay, parseNum, toDisplay } from '../../core/units.ts';
import { deleteExercise, saveExercise, useStore } from '../../state/store.ts';
import { LineChart } from '../charts.tsx';
import { Icon } from '../Icon.tsx';
import { Button, Card, Chip, confirm, Empty, Field, IconButton, SectionLabel, Segmented, Sheet, SheetScroll, Stat, T, toast } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { cap, ExerciseForm, ExerciseList, MuscleChips, SearchBox } from '../pickers.tsx';
import { Body, Header } from '../Screen.tsx';
import { relativeDay, space, tabular, useTheme } from '../theme.ts';

export function ExercisesScreen() {
  const c = useTheme();
  const nav = useNav();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all' | 'recent'>('all');
  const [creating, setCreating] = useState(false);
  const count = useStore((s) => s.exercises.size);
  return (
    <View style={{ flex: 1 }}>
      <Header title="Exercises" subtitle={`${count} exercises`} right={<IconButton name="plus" label="New exercise" onPress={() => setCreating(true)} bg={c.surfaceAlt} />} />
      <View style={{ paddingHorizontal: space(4) }}>
        <SearchBox value={query} onChange={setQuery} />
      </View>
      <MuscleChips value={muscle} onChange={setMuscle} showRecent />
      <View style={{ flex: 1 }}>
        <ExerciseList query={query} muscle={muscle} onPress={(ex) => nav.push({ name: 'exercise', id: ex.id })} />
      </View>
      <ExerciseForm
        visible={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onSaved={(ex) => {
          setCreating(false);
          nav.push({ name: 'exercise', id: ex.id });
        }}
      />
    </View>
  );
}

type Metric = 'e1rm' | 'top' | 'volume' | 'reps' | 'time' | 'distance';
type Range = '3m' | '1y' | 'all';

export function ExerciseDetailScreen({ id }: { id: string }) {
  const c = useTheme();
  const nav = useNav();
  const ex = useStore((s) => s.exercises.get(id));
  const workouts = useStore((s) => s.db.workouts);
  const settings = useStore((s) => s.db.settings);
  const unit = settings.unit;
  const [tab, setTab] = useState<'progress' | 'history' | 'records'>('progress');
  const [range, setRange] = useState<Range>('1y');
  const [editing, setEditing] = useState(false);
  const [coachSettings, setCoachSettings] = useState(false);

  const history = useMemo(() => exerciseHistory(workouts, id, settings.rpeAdjust), [workouts, id, settings.rpeAdjust]);
  const rec = useMemo(() => records(history), [history]);
  const kind = ex?.kind ?? 'weight';
  const metrics: { value: Metric; label: string }[] =
    kind === 'time'
      ? [{ value: 'time', label: 'Longest' }]
      : kind === 'cardio'
        ? [{ value: 'distance', label: 'Distance' }, { value: 'time', label: 'Time' }]
        : kind === 'weight'
          ? [
              { value: 'e1rm', label: 'Est. 1RM' },
              { value: 'top', label: 'Heaviest' },
              { value: 'volume', label: 'Volume' },
              { value: 'reps', label: 'Reps' },
            ]
          : [
              { value: 'reps', label: 'Total reps' },
              { value: 'top', label: 'Load' },
            ];
  const [metric, setMetric] = useState<Metric>(metrics[0].value);

  const points = useMemo(() => {
    const since = range === '3m' ? Date.now() - 92 * 86400000 : range === '1y' ? Date.now() - 365 * 86400000 : 0;
    return history
      .filter((s) => s.date >= since)
      .map((s) => {
        const value =
          metric === 'e1rm' ? s.bestE1rm : metric === 'top' ? s.topWeight : metric === 'volume' ? s.volume : metric === 'reps' ? s.totalReps : metric === 'time' ? (kind === 'cardio' ? s.working.reduce((a, x) => a + (x.seconds ?? 0), 0) : s.maxSeconds) : s.maxDistance;
        return value !== undefined && value > 0 ? { date: s.date, value } : null;
      })
      .filter((p): p is { date: number; value: number } => p !== null);
  }, [history, metric, range, kind]);

  if (!ex) return null;
  const coach = suggest(ex, history, unit);
  const [lo, hi] = repRange(ex);
  const isWeight = metric === 'e1rm' || metric === 'top' || metric === 'volume';
  const fmt = (v: number) =>
    isWeight
      ? `${metric === 'volume' ? fmtBig(toDisplay(v, unit)) : metric === 'e1rm' ? fmtEst(v, unit) : fmtWeight(v, unit)} ${unit}`
      : metric === 'time'
        ? fmtDuration(v)
        : metric === 'distance'
          ? `${fmtNum(v / (unit === 'kg' ? 1000 : 1609.344), 2)} ${unit === 'kg' ? 'km' : 'mi'}`
          : `${fmtNum(v)} reps`;
  const trend = metric === 'e1rm' ? trendPerMonth(points.slice(-12)) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={ex.name}
        subtitle={`${cap(ex.muscle)}${ex.secondary.length ? ' · ' + ex.secondary.map(cap).join(', ') : ''} · ${equipmentLabel(ex.equipment)}`}
        back
        right={ex.custom ? <IconButton name="edit" label="Edit exercise" onPress={() => setEditing(true)} bg={c.surfaceAlt} /> : undefined}
      />
      <View style={{ paddingHorizontal: space(4), paddingBottom: space(2) }}>
        <Segmented
          options={[
            { value: 'progress', label: 'Progress' },
            { value: 'records', label: 'Records' },
            { value: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <Body>
        {tab === 'progress' && (
          <>
            <Card style={{ borderColor: coach.action === 'deload' ? c.gold : c.accent, borderWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                <Icon name="target" size={18} color={coach.action === 'deload' ? c.gold : c.accent} />
                <T v="label" color={coach.action === 'deload' ? c.gold : c.accent} style={{ flex: 1 }}>
                  Next session
                </T>
                {kind !== 'time' && kind !== 'cardio' ? (
                  <Chip label={`${lo}–${hi} reps`} onPress={() => setCoachSettings(true)} icon="edit" />
                ) : null}
              </View>
              <T v="title" style={{ marginTop: space(2) }}>
                {coach.headline}
              </T>
              <T v="small" dim style={{ marginTop: space(1) }}>
                {coach.detail}
              </T>
            </Card>

            <SectionLabel>Chart</SectionLabel>
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) }}>
                {metrics.map((m) => (
                  <Chip key={m.value} label={m.label} active={metric === m.value} onPress={() => setMetric(m.value)} />
                ))}
              </View>
              <LineChart points={points} format={fmt} testID="exercise-chart" />
              <View style={{ marginTop: space(3) }}>
                <Segmented
                  options={[
                    { value: '3m', label: '3 months' },
                    { value: '1y', label: 'Year' },
                    { value: 'all', label: 'All time' },
                  ]}
                  value={range}
                  onChange={setRange}
                />
              </View>
              {trend !== undefined ? (
                <T v="small" dim center style={{ marginTop: space(3) }}>
                  {trend >= 0 ? 'Trending up' : 'Trending down'} {fmtEst(Math.abs(trend), unit)} {unit} a month over your last {Math.min(12, points.length)} sessions
                </T>
              ) : null}
            </Card>

            {rec.bestE1rm && kind === 'weight' ? (
              <>
                <SectionLabel>What you could lift today</SectionLabel>
                <Card>
                  <View style={styles.predictRow}>
                    {[1, 3, 5, 8, 10, 12].map((r) => (
                      <View key={r} style={{ alignItems: 'center', flex: 1 }}>
                        <T v="label" faint>
                          {r} rep{r > 1 ? 's' : ''}
                        </T>
                        <T v="bodyStrong" style={tabular}>
                          {fmtNum(toDisplay(weightForReps(latestE1rm(history) ?? rec.bestE1rm!.value, r), unit), 0)}
                        </T>
                      </View>
                    ))}
                  </View>
                  <T v="caption" faint center style={{ marginTop: space(2) }}>
                    Estimated from your best set in the last 4 sessions, in {unit}.
                  </T>
                </Card>
              </>
            ) : null}
          </>
        )}

        {tab === 'records' &&
          (history.length === 0 ? (
            <Empty icon="trophy" title="No records yet" body="Log this exercise once and your records start here." />
          ) : (
            <>
              <Card>
                <View style={{ flexDirection: 'row', gap: space(3), flexWrap: 'wrap' }}>
                  {rec.bestE1rm ? <Stat label="Est. 1RM" value={fmtEst(rec.bestE1rm.value, unit)} sub={relativeDay(rec.bestE1rm.date)} accent /> : null}
                  {rec.heaviest ? <Stat label={`Heaviest ${unit}`} value={fmtWeight(rec.heaviest.value, unit)} sub={`× ${rec.heaviest.reps} · ${relativeDay(rec.heaviest.date)}`} /> : null}
                  {rec.mostReps && kind !== 'weight' ? <Stat label="Most reps" value={String(rec.mostReps.value)} sub={relativeDay(rec.mostReps.date)} /> : null}
                  {rec.longest ? <Stat label="Longest" value={fmtDuration(rec.longest.value)} sub={relativeDay(rec.longest.date)} /> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: space(3), marginTop: space(4) }}>
                  {rec.bestSetVolume ? (
                    <Stat label="Best set" value={`${fmtWeight(rec.bestSetVolume.set.weight, unit)}×${rec.bestSetVolume.set.reps}`} sub={relativeDay(rec.bestSetVolume.date)} />
                  ) : null}
                  {rec.bestSessionVolume ? <Stat label={`Session ${unit}`} value={fmtBig(toDisplay(rec.bestSessionVolume.value, unit))} sub={relativeDay(rec.bestSessionVolume.date)} /> : null}
                  <Stat label="Sessions" value={String(history.length)} sub={`since ${relativeDay(history[0].date)}`} />
                </View>
              </Card>
              {rec.repMaxes.length ? (
                <>
                  <SectionLabel>Rep maxes</SectionLabel>
                  <Card style={{ paddingVertical: space(1) }}>
                    {rec.repMaxes.map((r) => (
                      <View key={r.reps} style={[styles.rmRow, { borderBottomColor: c.border }]}>
                        <T v="bodyStrong" style={{ width: 70 }}>
                          {r.reps} RM
                        </T>
                        <T v="body" style={[{ flex: 1 }, tabular]}>
                          {fmtWeight(r.weight, unit)} {unit}
                        </T>
                        <T v="small" faint>
                          {relativeDay(r.date)}
                        </T>
                      </View>
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          ))}

        {tab === 'history' &&
          (history.length === 0 ? (
            <Empty icon="history" title="Not logged yet" body="Every session of this exercise will be listed here." />
          ) : (
            [...history].reverse().map((s) => (
              <Card key={s.workoutId} style={{ marginBottom: space(3) }} onPress={() => nav.push({ name: 'workout', id: s.workoutId })}>
                <View style={{ flexDirection: 'row', marginBottom: space(1) }}>
                  <T v="bodyStrong" style={{ flex: 1 }}>
                    {relativeDay(s.date)}
                  </T>
                  {s.bestE1rm ? (
                    <T v="small" dim style={tabular}>
                      1RM {fmtEst(s.bestE1rm, unit)}
                    </T>
                  ) : null}
                </View>
                {s.sets.map((set, i) => (
                  <T key={i} v="small" dim={!isWorking(set)} style={tabular}>
                    {set.type === 'warmup' ? 'W  ' : set.type === 'drop' ? 'D  ' : set.type === 'failure' ? 'F  ' : `${i + 1}  `}
                    {kind === 'time'
                      ? `${set.seconds ?? 0}s`
                      : kind === 'cardio'
                        ? `${fmtNum((set.distance ?? 0) / 1000, 2)} km · ${fmtDuration(set.seconds ?? 0)}`
                        : `${set.weight ? fmtWeight(set.weight, unit) + ' ' + unit + ' × ' : ''}${set.reps ?? 0}${set.weight ? '' : ' reps'}`}
                    {set.rpe ? ` @${set.rpe}` : ''}
                  </T>
                ))}
              </Card>
            ))
          ))}

        {ex.custom ? (
          <Button
            label="Delete exercise"
            kind="danger"
            style={{ marginTop: space(6) }}
            onPress={() =>
              confirm('Delete this exercise?', history.length ? 'It has history, so it will be hidden from lists rather than deleted.' : 'This cannot be undone.', 'Delete', () => {
                deleteExercise(ex.id);
                nav.pop();
              })
            }
          />
        ) : null}
      </Body>

      <ExerciseForm visible={editing} editing={ex} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      <CoachSettings visible={coachSettings} onClose={() => setCoachSettings(false)} id={id} />
    </View>
  );
}

/** The best e1RM among the last four sessions: "today", not "ever". */
function latestE1rm(history: ReturnType<typeof exerciseHistory>): number | undefined {
  const recent = history.slice(-4).map((s) => s.bestE1rm ?? 0);
  const best = Math.max(0, ...recent);
  return best > 0 ? best : undefined;
}

function CoachSettings({ visible, onClose, id }: { visible: boolean; onClose: () => void; id: string }) {
  const ex = useStore((s) => s.exercises.get(id));
  const unit = useStore((s) => s.db.settings.unit);
  const [lo, setLo] = useState('');
  const [hi, setHi] = useState('');
  const [inc, setInc] = useState('');
  React.useEffect(() => {
    if (visible && ex) {
      const [a, b] = repRange(ex);
      setLo(String(a));
      setHi(String(b));
      setInc(fmtNum(toDisplay(incrementKg(ex, unit), unit), 2));
    }
  }, [visible]);
  if (!ex) return null;
  const presets: [number, number, string][] = [
    [3, 5, 'Strength'],
    [5, 8, 'Strength-size'],
    [8, 12, 'Hypertrophy'],
    [12, 20, 'Endurance'],
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Progression">
      <SheetScroll>
        <T v="small" dim>
          The coach keeps the weight until every working set reaches the top of this range, then adds the increment and starts again from the bottom.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {presets.map(([a, b, label]) => (
            <Chip key={label} label={`${label} ${a}–${b}`} active={lo === String(a) && hi === String(b)} onPress={() => (setLo(String(a)), setHi(String(b)))} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          <View style={{ flex: 1 }}>
            <Field label="Lowest reps" value={lo} onChangeText={setLo} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Highest reps" value={hi} onChangeText={setHi} keyboardType="number-pad" />
          </View>
        </View>
        <Field label={`Add this much when you go up (${unit})`} value={inc} onChangeText={setInc} keyboardType="decimal-pad" />
        <Button
          label="Save"
          onPress={() => {
            const a = Math.round(parseNum(lo) ?? 0);
            const b = Math.round(parseNum(hi) ?? 0);
            const i = parseNum(inc);
            if (!(a >= 1 && b >= a)) {
              toast('The range needs a low and a high', 'info');
              return;
            }
            saveExercise({ ...ex, repMin: a, repMax: b, incrementKg: i ? fromDisplay(i, unit) : undefined });
            onClose();
          }}
        />
      </SheetScroll>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  predictRow: { flexDirection: 'row' },
  rmRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2.5), borderBottomWidth: StyleSheet.hairlineWidth },
});

