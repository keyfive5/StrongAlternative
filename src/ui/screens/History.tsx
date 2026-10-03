// Every workout, newest first, grouped by month, under a training calendar.

import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { dayStart, e1rm, isWorking, workoutPrs, workoutVolume } from '../../core/analytics.ts';
import type { Workout } from '../../core/types.ts';
import { fmtBig, fmtDuration, fmtWeight, toDisplay } from '../../core/units.ts';
import { useStore } from '../../state/store.ts';
import { CalendarHeat } from '../charts.tsx';
import { Icon } from '../Icon.tsx';
import { Button, Card, Empty, T } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { SearchBox } from '../pickers.tsx';
import { Header } from '../Screen.tsx';
import { relativeDay, space, tabular, useTheme } from '../theme.ts';

export function HistoryScreen() {
  const c = useTheme();
  const nav = useNav();
  const workouts = useStore((s) => s.db.workouts);
  const exercises = useStore((s) => s.exercises);
  const settings = useStore((s) => s.db.settings);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(60);

  const finished = useMemo(() => workouts.filter((w) => w.end).sort((a, b) => b.start - a.start), [workouts]);

  const days = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of finished) {
      const d = dayStart(w.start);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [finished]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return finished;
    return finished.filter(
      (w) => w.name.toLowerCase().includes(q) || w.exercises.some((e) => exercises.get(e.exerciseId)?.name.toLowerCase().includes(q)),
    );
  }, [finished, query, exercises]);

  const prCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of filtered.slice(0, limit)) m.set(w.id, workoutPrs(w, finished, settings.rpeAdjust).length);
    return m;
  }, [filtered, limit, finished, settings.rpeAdjust]);

  const sections = useMemo(() => {
    const out: { title: string; data: Workout[] }[] = [];
    for (const w of filtered.slice(0, limit)) {
      const title = new Date(w.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const last = out[out.length - 1];
      if (last?.title === title) last.data.push(w);
      else out.push({ title, data: [w] });
    }
    return out;
  }, [filtered, limit]);

  return (
    <View style={{ flex: 1 }}>
      <Header title="History" subtitle={finished.length ? `${finished.length} workouts` : undefined} />
      {finished.length === 0 ? (
        <Empty icon="history" title="No workouts yet" body="Finished workouts land here with their records, volume and every set you logged." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(w) => w.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: space(4), paddingBottom: space(32) }}
          ListHeaderComponent={
            <View style={{ gap: space(3), marginBottom: space(2) }}>
              <Card>
                <T v="label" dim style={{ marginBottom: space(3) }}>
                  Last 6 months
                </T>
                <CalendarHeat days={days} weekStart={settings.weekStart} />
              </Card>
              <SearchBox value={query} onChange={setQuery} placeholder="Search workouts or exercises" />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <T v="label" dim style={{ marginTop: space(5), marginBottom: space(2), marginLeft: space(1) }}>
              {section.title}
            </T>
          )}
          renderItem={({ item: w }) => {
            const prs = prCounts.get(w.id) ?? 0;
            return (
              <Card style={{ marginBottom: space(3) }} onPress={() => nav.push({ name: 'workout', id: w.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(2) }}>
                  <View style={{ flex: 1 }}>
                    <T v="heading" numberOfLines={1}>
                      {w.name}
                    </T>
                    <T v="small" dim>
                      {relativeDay(w.start)}
                    </T>
                  </View>
                  {prs > 0 && (
                    <View style={[styles.pr, { backgroundColor: c.goldSoft }]}>
                      <Icon name="trophy" size={14} color={c.gold} />
                      <T v="caption" color={c.gold}>
                        {prs}
                      </T>
                    </View>
                  )}
                </View>
                <View style={styles.meta}>
                  <Meta icon="timer" text={fmtDuration(((w.end ?? w.start) - w.start) / 1000)} />
                  <Meta icon="dumbbell" text={`${fmtBig(toDisplay(workoutVolume(w), settings.unit))} ${settings.unit}`} />
                </View>
                <View style={{ gap: 3, marginTop: space(2) }}>
                  {w.exercises.slice(0, 5).map((we) => {
                    const ex = exercises.get(we.exerciseId);
                    const work = we.sets.filter(isWorking);
                    const best = work.reduce<{ s?: (typeof work)[0]; v: number }>((b, s) => {
                      const v = e1rm(s.weight ?? 0, s.reps ?? 0) ?? (s.reps ?? 0) / 1000;
                      return v > b.v ? { s, v } : b;
                    }, { v: -1 });
                    return (
                      <View key={we.id} style={{ flexDirection: 'row', gap: space(2) }}>
                        <T v="small" dim numberOfLines={1} style={{ flex: 1 }}>
                          {we.sets.length} × {ex?.name ?? 'Unknown'}
                        </T>
                        {best.s && ex?.kind === 'weight' ? (
                          <T v="small" faint style={tabular}>
                            {fmtWeight(best.s.weight, settings.unit)} × {best.s.reps}
                          </T>
                        ) : null}
                      </View>
                    );
                  })}
                  {w.exercises.length > 5 ? (
                    <T v="small" faint>
                      +{w.exercises.length - 5} more
                    </T>
                  ) : null}
                </View>
              </Card>
            );
          }}
          ListFooterComponent={
            filtered.length > limit ? <Button label="Show more" kind="secondary" onPress={() => setLimit((l) => l + 60)} /> : null
          }
        />
      )}
    </View>
  );
}

function Meta({ icon, text }: { icon: 'timer' | 'dumbbell'; text: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
      <Icon name={icon} size={14} color={c.textFaint} />
      <T v="small" dim style={tabular}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  pr: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: 99 },
  meta: { flexDirection: 'row', gap: space(4), marginTop: space(2) },
});
