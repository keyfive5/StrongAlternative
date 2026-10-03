// The workout in progress: a full-screen layer over the tabs, a minimised bar
// when you leave it, and the rest timer that follows you between them.

import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtClock } from '../core/units.ts';
import {
  adjustRest,
  discardActive,
  finishActive,
  stopRest,
  updateActive,
  useStore,
} from '../state/store.ts';
import { Icon } from './Icon.tsx';
import { ask, Button, haptic, IconButton, T } from './kit.tsx';
import { useNav } from './nav.ts';
import { Body } from './Screen.tsx';
import { NotesSheet, WorkoutEditor } from './WorkoutEditor.tsx';
import { radius, space, tabular, useTheme } from './theme.ts';

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Fires a buzz and clears the timer when rest runs out, wherever you are. */
export function RestWatcher() {
  const rest = useStore((s) => s.rest);
  useEffect(() => {
    if (!rest) return;
    const left = rest.endsAt - Date.now();
    const id = setTimeout(() => {
      haptic('warning');
      setTimeout(() => haptic('warning'), 350);
      stopRest();
    }, Math.max(0, left));
    return () => clearTimeout(id);
  }, [rest]);
  return null;
}

export function RestBar({ compact }: { compact?: boolean }) {
  const c = useTheme();
  const rest = useStore((s) => s.rest);
  const now = useNow(250);
  if (!rest) return null;
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  const f = Math.max(0, Math.min(1, left / rest.total));
  return (
    <View style={[styles.rest, { backgroundColor: c.raised }, compact && { marginHorizontal: 0 }]} testID="rest-bar">
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, overflow: 'hidden' }]}>
        <View style={{ width: `${f * 100}%`, height: '100%', backgroundColor: c.accentSoft }} />
      </View>
      <View>
        <Icon name="timer" size={20} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="title" style={tabular}>
          {fmtClock(Math.ceil(left))}
        </T>
        {!compact && (
          <T v="caption" dim numberOfLines={1}>
            Rest · {rest.exerciseName}
          </T>
        )}
      </View>
      <Pressable onPress={() => adjustRest(-15)} style={[styles.restBtn, { backgroundColor: c.surfaceAlt }]} accessibilityLabel="15 seconds less">
        <T v="smallStrong">−15</T>
      </Pressable>
      <Pressable onPress={() => adjustRest(15)} style={[styles.restBtn, { backgroundColor: c.surfaceAlt }]} accessibilityLabel="15 seconds more">
        <T v="smallStrong">+15</T>
      </Pressable>
      <Pressable onPress={stopRest} style={[styles.restBtn, { backgroundColor: c.accent }]} accessibilityLabel="Skip rest">
        <T v="smallStrong" color={c.accentText}>
          Skip
        </T>
      </Pressable>
    </View>
  );
}

/** Shown above the tab bar while a workout runs and its screen is closed. */
export function MiniWorkoutBar() {
  const c = useTheme();
  const nav = useNav();
  const active = useStore((s) => s.active);
  const now = useNow();
  if (!active) return null;
  return (
    <View style={{ paddingHorizontal: space(3), gap: space(2), paddingBottom: space(2) }}>
      <RestBar compact />
      <Pressable onPress={nav.openWorkout} style={[styles.mini, { backgroundColor: c.accent }]} testID="mini-workout">
        <Icon name="up" size={18} color={c.accentText} strokeWidth={2.6} />
        <T v="bodyStrong" color={c.accentText} style={{ flex: 1 }} numberOfLines={1}>
          {active.name}
        </T>
        <T v="bodyStrong" color={c.accentText} style={tabular}>
          {fmtClock((now - active.start) / 1000)}
        </T>
      </Pressable>
    </View>
  );
}

export function ActiveWorkoutScreen() {
  const c = useTheme();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const active = useStore((s) => s.active);
  const keepAwake = useStore((s) => s.db.settings.keepAwake);
  const now = useNow();
  const [notes, setNotes] = useState(false);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!keepAwake || Platform.OS === 'web') return;
    try {
      const K = require('expo-keep-awake') as typeof import('expo-keep-awake');
      void K.activateKeepAwakeAsync('workout');
      return () => {
        void K.deactivateKeepAwake('workout');
      };
    } catch {}
  }, [keepAwake]);

  if (!active) return null;

  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const pending = active.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => !s.done && (s.weight !== undefined || s.reps !== undefined || s.seconds !== undefined)).length,
    0,
  );

  const finish = () => {
    const complete = () => {
      const saved = finishActive();
      nav.closeWorkout();
      if (saved) {
        haptic('success');
        nav.push({ name: 'summary', id: saved.id });
      }
    };
    if (done === 0) {
      ask('Nothing logged yet', 'Tick off at least one set to save this workout, or discard it.', [
        { label: 'Keep training', kind: 'cancel' },
        { label: 'Discard workout', kind: 'danger', onPress: () => (discardActive(), nav.closeWorkout()) },
      ]);
      return;
    }
    if (pending > 0) {
      ask('Unfinished sets', `${pending} set${pending > 1 ? 's have' : ' has'} numbers entered but ${pending > 1 ? 'are' : 'is'} not ticked off.`, [
        {
          label: 'Tick them off and finish',
          kind: 'primary',
          onPress: () => {
            updateActive((w) => ({
              ...w,
              exercises: w.exercises.map((e) => ({
                ...e,
                sets: e.sets.map((s) => (!s.done && (s.reps !== undefined || s.seconds !== undefined || s.distance !== undefined) ? { ...s, done: true } : s)),
              })),
            }));
            complete();
          },
        },
        { label: 'Discard them and finish', onPress: complete },
        { label: 'Keep training', kind: 'cancel' },
      ]);
      return;
    }
    ask('Finish workout?', `${done} set${done > 1 ? 's' : ''} logged in ${fmtClock((Date.now() - active.start) / 1000)}.`, [
      { label: 'Finish', kind: 'primary', onPress: complete },
      { label: 'Keep training', kind: 'cancel' },
    ]);
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, zIndex: 20 }]} testID="active-workout">
      <View style={[styles.top, { paddingTop: insets.top + space(2) }]}>
        <IconButton name="down" label="Minimise workout" onPress={nav.closeWorkout} bg={c.surfaceAlt} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T v="title" style={tabular} testID="workout-clock">
            {fmtClock((now - active.start) / 1000)}
          </T>
        </View>
        <Button label="Finish" small onPress={finish} testID="finish-workout" />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Body contentContainerStyle={{ paddingTop: space(2) }}>
          <TextInput
            ref={nameRef}
            value={active.name}
            onChangeText={(name) => updateActive((w) => ({ ...w, name }))}
            style={[styles.name, { color: c.text }]}
            placeholder="Workout name"
            placeholderTextColor={c.textFaint}
            testID="workout-name"
          />
          <Pressable onPress={() => setNotes(true)} style={{ marginBottom: space(4) }}>
            <T v="small" dim>
              {active.notes || 'Add a workout note'}
            </T>
          </Pressable>
          <WorkoutEditor workout={active} onChange={updateActive} live />
          <Button
            label="Cancel workout"
            kind="danger"
            style={{ marginTop: space(6) }}
            onPress={() =>
              ask('Cancel this workout?', 'Nothing from this session will be saved.', [
                { label: 'Keep training', kind: 'cancel' },
                { label: 'Cancel workout', kind: 'danger', onPress: () => (discardActive(), nav.closeWorkout()) },
              ])
            }
          />
        </Body>
      </KeyboardAvoidingView>
      <View style={{ position: 'absolute', left: space(3), right: space(3), bottom: insets.bottom + space(3) }}>
        <RestBar />
      </View>
      <NotesSheet
        visible={notes}
        title="Workout note"
        initial={active.notes ?? ''}
        onClose={() => setNotes(false)}
        onSave={(t) => updateActive((w) => ({ ...w, notes: t || undefined }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingBottom: space(2) },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, paddingVertical: space(1) },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  restBtn: { paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.sm },
  mini: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3), borderRadius: radius.lg },
});
