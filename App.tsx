import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { flush, load, useStore } from './src/state/store.ts';
import { ActiveWorkoutScreen, MiniWorkoutBar, RestWatcher } from './src/ui/ActiveWorkout.tsx';
import { Icon, type IconName } from './src/ui/Icon.tsx';
import { DialogHost, ToastHost } from './src/ui/kit.tsx';
import { NavContext, type Nav, type Route, type Tab } from './src/ui/nav.ts';
import { DARK, LIGHT, ThemeContext, space, type } from './src/ui/theme.ts';
import { ExerciseDetailScreen, ExercisesScreen } from './src/ui/screens/Exercises.tsx';
import { HistoryScreen } from './src/ui/screens/History.tsx';
import { MeasureDetailScreen, ProgressScreen } from './src/ui/screens/Progress.tsx';
import { SettingsScreen } from './src/ui/screens/Settings.tsx';
import { EditWorkoutScreen, SummaryScreen, WorkoutDetailScreen } from './src/ui/screens/Summary.tsx';
import { TodayScreen } from './src/ui/screens/Today.tsx';
import { RoutineEditorScreen, TrainScreen } from './src/ui/screens/Train.tsx';

const TABS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'today', label: 'Today', icon: 'home' },
  { tab: 'history', label: 'History', icon: 'history' },
  { tab: 'train', label: 'Train', icon: 'dumbbell' },
  { tab: 'exercises', label: 'Exercises', icon: 'list' },
  { tab: 'progress', label: 'Progress', icon: 'chart' },
];

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'exercise':
      return <ExerciseDetailScreen id={route.id} />;
    case 'workout':
      return <WorkoutDetailScreen id={route.id} />;
    case 'editWorkout':
      return <EditWorkoutScreen id={route.id} />;
    case 'routine':
      return <RoutineEditorScreen id={route.id} />;
    case 'settings':
      return <SettingsScreen />;
    case 'measure':
      return <MeasureDetailScreen kind={route.kind} />;
    case 'summary':
      return <SummaryScreen id={route.id} />;
    default:
      return null;
  }
}

function TabView({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'today':
      return <TodayScreen />;
    case 'history':
      return <HistoryScreen />;
    case 'train':
      return <TrainScreen />;
    case 'exercises':
      return <ExercisesScreen />;
    case 'progress':
      return <ProgressScreen />;
  }
}

function Shell() {
  const insets = useSafeAreaInsets();
  const ready = useStore((s) => s.ready);
  const themePref = useStore((s) => s.db.settings.theme);
  const active = useStore((s) => s.active);
  const system = useColorScheme();
  const palette = (themePref === 'system' ? system ?? 'dark' : themePref) === 'light' ? LIGHT : DARK;
  const c = palette;

  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Route[]>([]);
  const [workoutOpen, setWorkoutOpen] = useState(false);

  useEffect(() => {
    void load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, []);

  const nav: Nav = useMemo(
    () => ({
      tab,
      setTab: (t) => {
        setStack([]);
        setTab(t);
      },
      push: (r) => setStack((s) => [...s, r]),
      pop: () => setStack((s) => s.slice(0, -1)),
      openWorkout: () => setWorkoutOpen(true),
      closeWorkout: () => setWorkoutOpen(false),
    }),
    [tab],
  );

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const top = stack[stack.length - 1];

  return (
    <ThemeContext.Provider value={palette}>
      <NavContext.Provider value={nav}>
        <StatusBar style={palette.dark ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{ flex: 1 }}>
            <TabView tab={tab} />
            {top ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
                <RouteView key={stack.length} route={top} />
              </View>
            ) : null}
          </View>
          {!(workoutOpen && active) && (
            <View style={{ backgroundColor: c.bg, paddingTop: space(2) }}>
              <MiniWorkoutBar />
              <View style={[styles.tabs, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, space(2)) }]}>
                {TABS.map((t) => {
                  const on = t.tab === tab && !top;
                  return (
                    <Pressable
                      key={t.tab}
                      testID={`tab-${t.tab}`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={t.label}
                      onPress={() => nav.setTab(t.tab)}
                      style={styles.tab}
                    >
                      <Icon name={t.icon} size={24} color={on ? c.accent : c.textFaint} strokeWidth={on ? 2.2 : 1.8} />
                      <Text style={[type.caption, { color: on ? c.accent : c.textFaint, fontSize: 11 }]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {workoutOpen && active ? <ActiveWorkoutScreen /> : null}
        </View>
        <RestWatcher />
        <DialogHost />
        <ToastHost />
      </NavContext.Provider>
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(2) },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
});
