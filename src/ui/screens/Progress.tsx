// Progress: training load over time, weekly sets per muscle, and the body.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { muscleSets, weekStart, weeklyBuckets } from '../../core/analytics.ts';
import { MUSCLES } from '../../core/library.ts';
import type { MeasureKind, Measurement } from '../../core/types.ts';
import { fmtBig, fmtDuration, fmtNum, parseNum, toDisplay, fromDisplay } from '../../core/units.ts';
import { addMeasurement, deleteMeasurement, useStore } from '../../state/store.ts';
import { BarChart, LineChart, Meter } from '../charts.tsx';
import { Icon } from '../Icon.tsx';
import { Button, Card, Chip, confirm, Field, SectionLabel, Segmented, Sheet, SheetScroll, T } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { cap } from '../pickers.tsx';
import { Body, Header } from '../Screen.tsx';
import { relativeDay, space, tabular, useTheme } from '../theme.ts';

export const MEASURES: { kind: MeasureKind; label: string }[] = [
  { kind: 'bodyweight', label: 'Body weight' },
  { kind: 'bodyfat', label: 'Body fat' },
  { kind: 'waist', label: 'Waist' },
  { kind: 'chest', label: 'Chest' },
  { kind: 'hips', label: 'Hips' },
  { kind: 'shoulders', label: 'Shoulders' },
  { kind: 'neck', label: 'Neck' },
  { kind: 'arm', label: 'Arm' },
  { kind: 'forearm', label: 'Forearm' },
  { kind: 'thigh', label: 'Thigh' },
  { kind: 'calf', label: 'Calf' },
];

/** Display unit and conversions for a measurement kind. */
export function measureUnit(kind: MeasureKind, unit: 'kg' | 'lb') {
  if (kind === 'bodyweight') return { label: unit, to: (v: number) => toDisplay(v, unit), from: (v: number) => fromDisplay(v, unit) };
  if (kind === 'bodyfat') return { label: '%', to: (v: number) => v, from: (v: number) => v };
  const inch = unit === 'lb';
  return { label: inch ? 'in' : 'cm', to: (v: number) => (inch ? v / 2.54 : v), from: (v: number) => (inch ? v * 2.54 : v) };
}

export function ProgressScreen() {
  const c = useTheme();
  const nav = useNav();
  const workouts = useStore((s) => s.db.workouts);
  const exercises = useStore((s) => s.exercises);
  const settings = useStore((s) => s.db.settings);
  const measurements = useStore((s) => s.db.measurements);
  const unit = settings.unit;
  const [metric, setMetric] = useState<'workouts' | 'volume' | 'sets' | 'time'>('workouts');
  const [week, setWeek] = useState<'this' | 'last'>('this');
  const [adding, setAdding] = useState<MeasureKind | null>(null);

  const buckets = useMemo(() => weeklyBuckets(workouts, 12, settings.weekStart), [workouts, settings.weekStart]);
  const values = buckets.map((b) => (metric === 'workouts' ? b.workouts : metric === 'volume' ? toDisplay(b.volume, unit) : metric === 'sets' ? b.sets : b.seconds));
  const labels = buckets.map((b) => new Date(b.start).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }));

  const sets = useMemo(() => {
    const thisWeek = weekStart(Date.now(), settings.weekStart);
    const from = week === 'this' ? thisWeek : thisWeek - 7 * 86400000;
    const to = week === 'this' ? thisWeek + 7 * 86400000 : thisWeek;
    return muscleSets(workouts, exercises, from, to);
  }, [workouts, exercises, week, settings.weekStart]);

  const latest = useMemo(() => {
    const m = new Map<MeasureKind, Measurement[]>();
    for (const x of [...measurements].sort((a, b) => a.at - b.at)) m.set(x.kind, [...(m.get(x.kind) ?? []), x]);
    return m;
  }, [measurements]);

  const muscles = MUSCLES.filter((m) => !['cardio', 'other', 'full body'].includes(m));
  const target = settings.weeklySetTarget;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Progress" />
      <Body>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) }}>
            {(
              [
                ['workouts', 'Workouts'],
                ['volume', `Volume`],
                ['sets', 'Sets'],
                ['time', 'Time'],
              ] as const
            ).map(([v, l]) => (
              <Chip key={v} label={l} active={metric === v} onPress={() => setMetric(v)} />
            ))}
          </View>
          <BarChart
            values={values}
            labels={labels}
            format={(v) => (metric === 'volume' ? `${fmtBig(v)} ${unit}` : metric === 'time' ? fmtDuration(v) : `${fmtNum(v, 0)} ${metric}`)}
          />
          <T v="caption" faint center style={{ marginTop: space(1) }}>
            Last 12 weeks · tap a bar
          </T>
        </Card>

        <SectionLabel>Hard sets per muscle</SectionLabel>
        <Card>
          <Segmented
            options={[
              { value: 'this', label: 'This week' },
              { value: 'last', label: 'Last week' },
            ]}
            value={week}
            onChange={setWeek}
          />
          <View style={{ gap: space(3), marginTop: space(4) }}>
            {muscles.map((m) => {
              const n = sets.get(m) ?? 0;
              const hit = n >= target;
              return (
                <View key={m} style={{ gap: space(1) }}>
                  <View style={{ flexDirection: 'row' }}>
                    <T v="smallStrong" style={{ flex: 1 }}>
                      {cap(m)}
                    </T>
                    <T v="small" color={hit ? c.accent : c.textDim} style={tabular}>
                      {fmtNum(n, 1)} / {target}
                    </T>
                  </View>
                  <Meter value={n} max={target} color={hit ? c.accent : c.info} />
                </View>
              );
            })}
          </View>
          <T v="caption" faint style={{ marginTop: space(4) }}>
            Working sets count fully for the main muscle and half for each muscle that assists. Around 10 hard sets a week per muscle is a common target for growth; change it in Settings.
          </T>
        </Card>

        <SectionLabel>Body</SectionLabel>
        <Card style={{ paddingVertical: space(1) }}>
          {MEASURES.map((m, i) => {
            const list = latest.get(m.kind);
            const last = list?.[list.length - 1];
            const prev = list && list.length > 1 ? list[list.length - 2] : undefined;
            const u = measureUnit(m.kind, unit);
            const delta = last && prev ? u.to(last.value) - u.to(prev.value) : undefined;
            return (
              <Pressable
                key={m.kind}
                onPress={() => (list?.length ? nav.push({ name: 'measure', kind: m.kind }) : setAdding(m.kind))}
                style={[styles.measureRow, i < MEASURES.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                testID={`measure-${m.kind}`}
              >
                <T v="bodyStrong" style={{ flex: 1 }}>
                  {m.label}
                </T>
                {last ? (
                  <>
                    {delta !== undefined && Math.abs(delta) > 0.001 ? (
                      <T v="small" dim style={tabular}>
                        {delta > 0 ? '+' : '−'}
                        {fmtNum(Math.abs(delta), 1)}
                      </T>
                    ) : null}
                    <T v="bodyStrong" style={tabular}>
                      {fmtNum(u.to(last.value), 1)} {u.label}
                    </T>
                    <Icon name="chevron" size={16} color={c.textFaint} />
                  </>
                ) : (
                  <Icon name="plus" size={18} color={c.accent} />
                )}
              </Pressable>
            );
          })}
        </Card>
      </Body>
      <MeasureSheet kind={adding} onClose={() => setAdding(null)} />
    </View>
  );
}

export function MeasureSheet({ kind, onClose }: { kind: MeasureKind | null; onClose: () => void }) {
  const unit = useStore((s) => s.db.settings.unit);
  const [text, setText] = useState('');
  const meta = MEASURES.find((m) => m.kind === kind);
  const u = kind ? measureUnit(kind, unit) : null;
  return (
    <Sheet visible={!!kind} onClose={() => (setText(''), onClose())} title={meta ? `Log ${meta.label.toLowerCase()}` : ''}>
      <SheetScroll>
        <Field label={u ? `Today, in ${u.label}` : ''} value={text} onChangeText={setText} keyboardType="decimal-pad" autoFocus testID="measure-value" />
        <Button
          label="Save"
          disabled={parseNum(text) === undefined}
          onPress={() => {
            const v = parseNum(text);
            if (v === undefined || !kind || !u) return;
            addMeasurement({ kind, at: Date.now(), value: u.from(v) });
            setText('');
            onClose();
          }}
          testID="measure-save"
        />
      </SheetScroll>
    </Sheet>
  );
}

export function MeasureDetailScreen({ kind }: { kind: MeasureKind }) {
  const c = useTheme();
  const unit = useStore((s) => s.db.settings.unit);
  const all = useStore((s) => s.db.measurements);
  const [adding, setAdding] = useState<MeasureKind | null>(null);
  const list = useMemo(() => all.filter((m) => m.kind === kind).sort((a, b) => a.at - b.at), [all, kind]);
  const meta = MEASURES.find((m) => m.kind === kind)!;
  const u = measureUnit(kind, unit);
  return (
    <View style={{ flex: 1 }}>
      <Header title={meta.label} back right={<Button label="Log" icon="plus" small onPress={() => setAdding(kind)} />} />
      <Body>
        <Card>
          <LineChart points={list.map((m) => ({ date: m.at, value: u.to(m.value) }))} format={(v) => `${fmtNum(v, 1)} ${u.label}`} />
        </Card>
        <SectionLabel>Entries</SectionLabel>
        <Card style={{ paddingVertical: space(1) }}>
          {[...list].reverse().map((m) => (
            <Pressable
              key={m.id}
              onLongPress={() => confirm('Delete this entry?', '', 'Delete', () => deleteMeasurement(m.id))}
              style={[styles.measureRow, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <T style={{ flex: 1 }}>{relativeDay(m.at)}</T>
              <T v="bodyStrong" style={tabular}>
                {fmtNum(u.to(m.value), 1)} {u.label}
              </T>
            </Pressable>
          ))}
        </Card>
        <T v="caption" faint center style={{ marginTop: space(2) }}>
          Press and hold an entry to delete it.
        </T>
      </Body>
      <MeasureSheet kind={adding} onClose={() => setAdding(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  measureRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(3), minHeight: 48 },
});
