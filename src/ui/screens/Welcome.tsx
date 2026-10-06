// First launch: what the coach does, units and goal, and how to start —
// with your own history, with six months of sample training, or fresh.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Goal } from '../../core/coach.ts';
import type { Unit } from '../../core/types.ts';
import { completeOnboarding, loadSampleData, updateSettings, useStore } from '../../state/store.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { Button, haptic, T } from '../kit.tsx';
import { useNav } from '../nav.ts';
import { radius, space, useTheme } from '../theme.ts';

const GOALS: { value: Goal; title: string; body: string }[] = [
  { value: 'strength', title: 'Get stronger', body: 'Heavy 3–5 rep sets on the big lifts. The number on the bar is the point.' },
  { value: 'muscle', title: 'Build muscle', body: 'Moderate 6–12 rep sets, plenty of them. Size first, strength follows.' },
  { value: 'general', title: 'Bit of both', body: 'Strength ranges on the main lifts, higher reps on everything else.' },
];

export function WelcomeScreen({ onImport }: { onImport: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const settings = useStore((s) => s.db.settings);
  const [step, setStep] = useState(0);

  const finish = (then?: () => void) => {
    completeOnboarding();
    haptic('success');
    then?.();
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, zIndex: 50, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space(4)) }]} testID="welcome">
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === step ? c.accent : c.raised, width: i === step ? 22 : 8 }]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space(6), paddingBottom: space(6), flexGrow: 1 }}>
        {step === 0 && (
          <View style={{ gap: space(5), flex: 1 }}>
            <View style={{ gap: space(2), marginTop: space(6) }}>
              <T v="hero">Lift a little more{'\n'}every session.</T>
              <T dim>Overload is a training log with a coach in it. It reads what you lifted last time and tells you what to lift today.</T>
            </View>
            <ExampleCoach />
            <View style={{ gap: space(4) }}>
              <Point icon="target" title="A target for every set" body="Hit the top of your rep range and it adds weight; fall short and it holds you there until you do." />
              <Point icon="bolt" title="Reads the day you are having" body="After your first hard set it compares you with your recent sessions and adjusts the rest of the workout." />
              <Point icon="info" title="Explains a plateau" body="When a lift stalls it checks your weekly volume, frequency and rep range, and tells you what to change." />
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: space(5), marginTop: space(6) }}>
            <T v="display">How do you train?</T>
            <View style={{ gap: space(2) }}>
              <T v="label" dim>
                Weights in
              </T>
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                {(['kg', 'lb'] as Unit[]).map((u) => (
                  <Choice key={u} grow on={settings.unit === u} onPress={() => updateSettings({ unit: u })} testID={`unit-${u}`}>
                    <T v="title">{u}</T>
                  </Choice>
                ))}
              </View>
            </View>
            <View style={{ gap: space(2) }}>
              <T v="label" dim>
                Your goal
              </T>
              {GOALS.map((g) => (
                <Choice key={g.value} on={settings.goal === g.value} onPress={() => updateSettings({ goal: g.value })} testID={`goal-${g.value}`}>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{g.title}</T>
                    <T v="small" dim>
                      {g.body}
                    </T>
                  </View>
                </Choice>
              ))}
              <T v="caption" faint>
                This sets the coach's default rep ranges. You can change it later, or set a range per exercise.
              </T>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: space(4), marginTop: space(6) }}>
            <T v="display">How do you want to start?</T>
            <StartOption
              icon="chart"
              title="Explore with sample data"
              body="Six months of push / pull / legs training, so you can see the coach, charts and records at work. Clear it in one tap from the Today screen."
              onPress={() => finish(loadSampleData)}
              testID="start-sample"
              primary
            />
            <StartOption
              icon="download"
              title="Bring your history"
              body="Import the CSV export from Strong or Hevy. Every set, set type, RPE and note comes across, and the coach works on it straight away."
              onPress={() => finish(onImport)}
              testID="start-import"
            />
            <StartOption
              icon="dumbbell"
              title="Start fresh"
              body="Pick a programme or build your own routine. The coach starts learning from your first session."
              onPress={() => finish(() => nav.setTab('train'))}
              testID="start-fresh"
            />
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: space(6), flexDirection: 'row', gap: space(3) }}>
        {step > 0 ? <Button label="Back" kind="secondary" onPress={() => setStep(step - 1)} /> : null}
        {step < 2 ? <Button label="Continue" style={{ flex: 1 }} onPress={() => setStep(step + 1)} testID="welcome-next" /> : null}
      </View>
    </View>
  );
}

/** A miniature of the workout screen's coach, so the idea is shown, not described. */
function ExampleCoach() {
  const c = useTheme();
  const unit = useStore((s) => s.db.settings.unit);
  const w = unit === 'kg' ? ['80', '82.5'] : ['175', '180'];
  return (
    <View style={[styles.example, { backgroundColor: c.surface, borderColor: c.border }]}>
      <T v="heading" color={c.accent}>
        Bench Press (Barbell)
      </T>
      <View style={[styles.exCoach, { backgroundColor: c.accentSoft }]}>
        <Icon name="up" size={16} color={c.accent} strokeWidth={2.6} />
        <T v="smallStrong" color={c.accent}>
          Go up to {w[1]} {unit}
        </T>
      </View>
      <T v="small" dim>
        Last time: {w[0]} {unit} × 8, 8, 8 — the top of your range on every set.
      </T>
    </View>
  );
}

function Point({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space(3) }}>
      <View style={[styles.pointIcon, { backgroundColor: c.accentSoft }]}>
        <Icon name={icon} size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{title}</T>
        <T v="small" dim>
          {body}
        </T>
      </View>
    </View>
  );
}

function Choice({
  on,
  onPress,
  children,
  testID,
  grow,
}: {
  on: boolean;
  onPress: () => void;
  children: React.ReactNode;
  testID?: string;
  /** Share a row equally with its siblings. */
  grow?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={[
        styles.choice,
        grow && { flex: 1 },
        { backgroundColor: c.surface, borderColor: on ? c.accent : c.border, borderWidth: on ? 2 : StyleSheet.hairlineWidth },
      ]}
    >
      {children}
      {on ? <Icon name="check" size={18} color={c.accent} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

function StartOption({
  icon,
  title,
  body,
  onPress,
  primary,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.start,
        { backgroundColor: primary ? c.accentSoft : c.surface, borderColor: primary ? c.accent : c.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.pointIcon, { backgroundColor: primary ? c.accent : c.surfaceAlt }]}>
        <Icon name={icon} size={18} color={primary ? c.accentText : c.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyStrong">{title}</T>
        <T v="small" dim>
          {body}
        </T>
      </View>
      <Icon name="chevron" size={16} color={c.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: space(3) },
  dot: { height: 8, borderRadius: 4 },
  example: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space(4), gap: space(2) },
  exCoach: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(2.5), borderRadius: radius.md },
  pointIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg },
  start: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 1 },
});
