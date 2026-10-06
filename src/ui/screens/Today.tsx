// Today: what to train next, what is ready to progress, and how the week is going.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { weekStart, weekStreak, workoutPrs, workoutSetCount, workoutVolume } from '../../core/analytics.ts';
import type { Suggestion } from '../../core/coach.ts';
import type { Prescription } from '../../core/insight.ts';
import type { Exercise, Routine, Workout } from '../../core/types.ts';
import { fmtBig, fmtWeight, toDisplay } from '../../core/units.ts';
import { clearSampleData, hasSampleData, startWorkout, useStore } from '../../state/store.ts';
import { coachFor, diagnosisFor, useHistories } from '../coaching.ts';
import { Icon } from '../Icon.tsx';
import { Button, Card, confirm, IconButton, SectionLabel, Stat, T } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { Body, Header } from '../Screen.tsx';
import { fmtDate, radius, relativeDay, space, useTheme } from '../theme.ts';
import { prLabel } from './Summary.tsx';

/** The routine after the one you did last, cycling within its programme. */
export function nextRoutine(routines: Routine[], workouts: Workout[]): Routine | undefined {
  if (!routines.length) return undefined;
  const last = [...workouts].reverse().find((w) => w.end && w.routineId && routines.some((r) => r.id === w.routineId));
  if (!last) return routines[0];
  const done = routines.find((r) => r.id === last.routineId)!;
  const group = routines.filter((r) => (r.folder ?? '') === (done.folder ?? ''));
  return group[(group.indexOf(done) + 1) % group.length];
}

export function TodayScreen() {
  const c = useTheme();
  const nav = useNav();
  const workouts = useStore((s) => s.db.workouts);
  const routines = useStore((s) => s.db.routines);
  const exercises = useStore((s) => s.exercises);
  const settings = useStore((s) => s.db.settings);
  const active = useStore((s) => s.active);
  const unit = settings.unit;

  const finished = useMemo(() => workouts.filter((w) => w.end).sort((a, b) => a.start - b.start), [workouts]);
  const next = useMemo(() => nextRoutine(routines, finished), [routines, finished]);

  const week = useMemo(() => {
    const from = weekStart(Date.now(), settings.weekStart);
    const ws = finished.filter((w) => w.start >= from);
    return {
      count: ws.length,
      sets: ws.reduce((n, w) => n + workoutSetCount(w), 0),
      volume: ws.reduce((n, w) => n + workoutVolume(w), 0),
      streak: weekStreak(finished, settings.weekStart),
    };
  }, [finished, settings.weekStart]);

  // The overload board: every exercise trained in the last six weeks, sorted
  // into "ready to go up" and "stalled".
  const histories = useHistories();
  const sample = useStore((s) => hasSampleData(s.db));
  const board = useMemo(() => {
    const since = Date.now() - 42 * 86400000;
    const ids = new Set<string>();
    for (const w of finished) if (w.start >= since) for (const e of w.exercises) ids.add(e.exerciseId);
    const up: { ex: Exercise; s: Suggestion }[] = [];
    const stuck: { ex: Exercise; s: Suggestion; rx: Prescription[] }[] = [];
    for (const id of ids) {
      const ex = exercises.get(id);
      if (!ex || ex.kind === 'cardio' || ex.kind === 'time') continue;
      const s = coachFor(ex, histories, exercises, unit, settings.goal);
      if (s.action === 'increase') up.push({ ex, s });
      else if (s.action === 'deload' || s.action === 'hold') stuck.push({ ex, s, rx: diagnosisFor(ex, histories, finished, exercises, settings) });
    }
    return { up: up.slice(0, 6), stuck: stuck.slice(0, 4) };
  }, [finished, exercises, unit, settings, histories]);

  const recentPrs = useMemo(() => {
    const out: { w: Workout; label: string; exName: string }[] = [];
    for (const w of finished.slice(-8).reverse()) {
      for (const pr of workoutPrs(w, finished, settings.rpeAdjust)) {
        if (pr.kind === 'repmax' || pr.kind === 'volume') continue;
        out.push({ w, label: prLabel(pr, unit), exName: exercises.get(pr.exerciseId)?.name ?? '' });
      }
      if (out.length >= 5) break;
    }
    return out.slice(0, 5);
  }, [finished, exercises, unit, settings.rpeAdjust]);

  const lastWorkout = finished[finished.length - 1];

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={greeting()}
        subtitle={fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })}
        right={<IconButton name="settings" label="Settings" onPress={() => nav.push({ name: 'settings' })} bg={c.surfaceAlt} />}
      />
      <Body>
        {sample ? (
          <View style={[styles.sample, { backgroundColor: c.surfaceAlt, borderColor: c.border }]} testID="sample-banner">
            <Icon name="info" size={18} color={c.info} />
            <T v="small" dim style={{ flex: 1 }}>
              You are exploring six months of sample training. Everything works on it; clear it when you are ready to log your own.
            </T>
            <Button
              label="Clear"
              kind="secondary"
              small
              onPress={() =>
                confirm('Clear the sample data?', 'Sample workouts, routines and measurements are removed. Anything you logged yourself stays.', 'Clear sample data', clearSampleData, false)
              }
            />
          </View>
        ) : null}
        {active ? (
          <Card style={{ borderColor: c.accent, borderWidth: 1 }} onPress={nav.openWorkout}>
            <T v="label" color={c.accent}>
              In progress
            </T>
            <T v="title">{active.name}</T>
            <T dim v="small">
              Tap to return to your workout
            </T>
          </Card>
        ) : next ? (
          <Card>
            <T v="label" dim>
              Up next
            </T>
            <T v="title" style={{ marginTop: 2 }}>
              {next.name}
            </T>
            {next.folder ? (
              <T v="small" dim>
                {next.folder}
              </T>
            ) : null}
            <View style={{ marginTop: space(3), gap: space(1.5) }}>
              {next.exercises.slice(0, 6).map((re, i) => {
                const ex = exercises.get(re.exerciseId);
                return (
                  <View key={i} style={styles.line}>
                    <T v="small" dim style={{ width: 28 }}>
                      {re.sets.length}×
                    </T>
                    <T v="small" numberOfLines={1} style={{ flex: 1 }}>
                      {ex?.name ?? re.exerciseId}
                    </T>
                  </View>
                );
              })}
              {next.exercises.length > 6 ? (
                <T v="small" faint>
                  +{next.exercises.length - 6} more
                </T>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
              <Button
                label={`Start ${next.name}`}
                icon="play"
                style={{ flex: 1 }}
                onPress={() => {
                  startWorkout(next);
                  nav.openWorkout();
                }}
                testID="start-next"
              />
              <Button label="Empty" kind="secondary" onPress={() => (startWorkout(), nav.openWorkout())} />
            </View>
          </Card>
        ) : (
          <Card>
            <T v="title">Ready when you are</T>
            <T dim style={{ marginTop: space(1) }}>
              Start an empty workout and add exercises as you go, or pick a programme on the Train tab.
            </T>
            <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
              <Button label="Start workout" icon="play" style={{ flex: 1 }} onPress={() => (startWorkout(), nav.openWorkout())} testID="start-empty" />
              <Button label="Plans" kind="secondary" onPress={() => nav.setTab('train')} />
            </View>
          </Card>
        )}

        <SectionLabel>This week</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Stat label="Workouts" value={String(week.count)} />
            <Stat label="Sets" value={String(week.sets)} />
            <Stat label={`Volume ${unit}`} value={fmtBig(toDisplay(week.volume, unit))} />
          </View>
          <View style={[styles.streak, { backgroundColor: c.surfaceAlt }]}>
            <Icon name="flame" size={18} color={week.streak ? c.gold : c.textFaint} />
            <T v="smallStrong" style={{ flex: 1 }}>
              {week.streak ? `${week.streak}-week streak` : 'Train this week to start a streak'}
            </T>
            {lastWorkout ? (
              <T v="small" dim>
                Last: {relativeDay(lastWorkout.start)}
              </T>
            ) : null}
          </View>
        </Card>

        {board.up.length > 0 && (
          <>
            <SectionLabel>Ready to add weight</SectionLabel>
            <Card style={{ paddingVertical: space(1) }}>
              {board.up.map(({ ex, s }) => (
                <Pressable key={ex.id} onPress={() => nav.push({ name: 'exercise', id: ex.id })} style={styles.boardRow}>
                  <View style={[styles.dot, { backgroundColor: c.accentSoft }]}>
                    <Icon name="up" size={16} color={c.accent} strokeWidth={2.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" numberOfLines={1}>
                      {ex.name}
                    </T>
                    <T v="small" dim numberOfLines={1}>
                      {s.headline}
                    </T>
                  </View>
                  <Icon name="chevron" size={16} color={c.textFaint} />
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {board.stuck.length > 0 && (
          <>
            <SectionLabel>Stalled</SectionLabel>
            <Card style={{ paddingVertical: space(1) }}>
              {board.stuck.map(({ ex, s, rx }) => (
                <Pressable key={ex.id} onPress={() => nav.push({ name: 'exercise', id: ex.id })} style={styles.boardRow}>
                  <View style={[styles.dot, { backgroundColor: c.goldSoft }]}>
                    <Icon name="info" size={16} color={c.gold} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" numberOfLines={1}>
                      {ex.name}
                    </T>
                    <T v="small" dim numberOfLines={1}>
                      {rx[0] ? `Try: ${rx[0].title}` : s.action === 'deload' ? s.headline : `${s.stalled} sessions without progress`}
                    </T>
                  </View>
                  <Icon name="chevron" size={16} color={c.textFaint} />
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {recentPrs.length > 0 && (
          <>
            <SectionLabel>Recent records</SectionLabel>
            <Card style={{ paddingVertical: space(1) }}>
              {recentPrs.map((p, i) => (
                <Pressable key={i} onPress={() => nav.push({ name: 'workout', id: p.w.id })} style={styles.boardRow}>
                  <View style={[styles.dot, { backgroundColor: c.goldSoft }]}>
                    <Icon name="trophy" size={16} color={c.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" numberOfLines={1}>
                      {p.exName}
                    </T>
                    <T v="small" dim numberOfLines={1}>
                      {p.label} · {relativeDay(p.w.start)}
                    </T>
                  </View>
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {finished.length === 0 && (
          <Card style={{ marginTop: space(5), backgroundColor: c.surfaceAlt }} onPress={() => nav.push({ name: 'settings' })}>
            <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
              <Icon name="download" size={22} color={c.accent} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">Coming from another app?</T>
                <T v="small" dim>
                  Import your full history from a Strong or Hevy CSV export in Settings. Every chart and record works on it immediately.
                </T>
              </View>
            </View>
          </Card>
        )}
        {lastWorkout && week.count === 0 && finished.length > 0 ? (
          <T v="small" faint center style={{ marginTop: space(5) }}>
            Your last session was {relativeDay(lastWorkout.start).toLowerCase()}: {lastWorkout.name}, {fmtWeight(workoutVolume(lastWorkout), unit)} {unit} moved.
          </T>
        ) : null}
      </Body>
    </View>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late session?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  sample: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: space(3) },
  line: { flexDirection: 'row', alignItems: 'center' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radius.md, marginTop: space(4) },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
