// Exercise picker and the create/edit exercise form.

import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { EQUIPMENT, MUSCLES, equipmentLabel, nameKey } from '../core/library.ts';
import type { Equipment, Exercise, ExerciseKind, Muscle } from '../core/types.ts';
import { createExercise, saveExercise, useStore } from '../state/store.ts';
import { Icon } from './Icon.tsx';
import { Button, Chip, Field, Segmented, Sheet, SheetScroll, T } from './kit.tsx';
import { radius, space, useTheme } from './theme.ts';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Search that forgives word order and plurals: "curl db" finds "Bicep Curl (Dumbbell)". */
export function matches(ex: Exercise, query: string): boolean {
  if (!query.trim()) return true;
  const hay = nameKey(`${ex.name} ${ex.muscle} ${ex.equipment}`);
  return nameKey(query)
    .split(' ')
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/** Most-used first, then alphabetical: the exercises you do are the ones you want. */
export function useExerciseUsage(): Map<string, { count: number; last: number }> {
  const workouts = useStore((s) => s.db.workouts);
  return useMemo(() => {
    const m = new Map<string, { count: number; last: number }>();
    for (const w of workouts) {
      for (const we of w.exercises) {
        const cur = m.get(we.exerciseId) ?? { count: 0, last: 0 };
        cur.count++;
        cur.last = Math.max(cur.last, w.start);
        m.set(we.exerciseId, cur);
      }
    }
    return m;
  }, [workouts]);
}

export function ExerciseList({
  query,
  muscle,
  onPress,
  selected,
  header,
}: {
  query: string;
  muscle: Muscle | 'all' | 'recent';
  onPress: (ex: Exercise) => void;
  selected?: string[];
  header?: React.ReactElement;
}) {
  const c = useTheme();
  const exercises = useStore((s) => s.exercises);
  const usage = useExerciseUsage();
  const list = useMemo(() => {
    let all = [...exercises.values()].filter((e) => !e.archived && matches(e, query));
    if (muscle === 'recent') all = all.filter((e) => usage.has(e.id)).sort((a, b) => usage.get(b.id)!.last - usage.get(a.id)!.last);
    else {
      if (muscle !== 'all') all = all.filter((e) => e.muscle === muscle || e.secondary.includes(muscle));
      all.sort((a, b) => {
        const ua = usage.get(a.id)?.count ?? 0;
        const ub = usage.get(b.id)?.count ?? 0;
        if (query && ua !== ub) return ub - ua;
        return a.name.localeCompare(b.name);
      });
    }
    return all;
  }, [exercises, query, muscle, usage]);

  return (
    <FlatList
      data={list}
      keyExtractor={(e) => e.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={header}
      initialNumToRender={20}
      contentContainerStyle={{ paddingHorizontal: space(4), paddingBottom: space(30) }}
      ListEmptyComponent={
        <T dim center style={{ marginTop: space(10) }}>
          {muscle === 'recent' ? 'Exercises you log will show up here.' : 'No exercises match.'}
        </T>
      }
      renderItem={({ item }) => {
        const on = selected?.includes(item.id);
        const n = usage.get(item.id)?.count;
        return (
          <Pressable
            onPress={() => onPress(item)}
            testID={`ex-${item.id}`}
            style={({ pressed }) => [
              styles.exRow,
              { borderBottomColor: c.border, backgroundColor: on ? c.accentSoft : 'transparent', opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: on ? c.accent : c.surfaceAlt }]}>
              {on ? (
                <Icon name="check" size={18} color={c.accentText} strokeWidth={2.6} />
              ) : (
                <T v="heading" color={c.textDim}>
                  {item.name.charAt(0)}
                </T>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="bodyStrong" numberOfLines={1}>
                {item.name}
              </T>
              <T v="small" dim numberOfLines={1}>
                {cap(item.muscle)}
                {item.custom ? ' · custom' : ''}
              </T>
            </View>
            {n ? (
              <T v="caption" faint>
                {n}×
              </T>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

export function MuscleChips({ value, onChange, showRecent }: { value: Muscle | 'all' | 'recent'; onChange: (m: Muscle | 'all' | 'recent') => void; showRecent?: boolean }) {
  const opts: (Muscle | 'all' | 'recent')[] = [...(showRecent ? (['recent'] as const) : []), 'all', ...MUSCLES.filter((m) => m !== 'other')];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: space(2), paddingHorizontal: space(4), paddingVertical: space(2), alignItems: 'center' }}
    >
      {opts.map((m) => (
        <Chip key={m} label={m === 'all' ? 'All' : m === 'recent' ? 'Recent' : cap(m)} active={value === m} onPress={() => onChange(m)} />
      ))}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search exercises' }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  const c = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: c.surfaceAlt }]}>
      <Icon name="search" size={18} color={c.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        autoCorrect={false}
        style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: space(2.5) }}
        testID="exercise-search"
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Clear search">
          <Icon name="close" size={16} color={c.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pick one or several exercises. */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  multi = true,
  title = 'Add exercises',
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all' | 'recent'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const c = useTheme();
  const close = () => {
    setSelected([]);
    setQuery('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={title} full>
      <View style={{ paddingHorizontal: space(4), gap: space(1) }}>
        <SearchBox value={query} onChange={setQuery} />
      </View>
      <MuscleChips value={muscle} onChange={setMuscle} showRecent />
      <View style={{ flex: 1 }}>
        <ExerciseList
          query={query}
          muscle={muscle}
          selected={selected}
          onPress={(ex) => {
            if (!multi) {
              onPick([ex.id]);
              close();
              return;
            }
            setSelected((s) => (s.includes(ex.id) ? s.filter((x) => x !== ex.id) : [...s, ex.id]));
          }}
          header={
            <Pressable onPress={() => setCreating(true)} style={styles.createRow}>
              <Icon name="plus" size={18} color={c.accent} />
              <T v="bodyStrong" color={c.accent}>
                {query ? `Create “${query}”` : 'Create a new exercise'}
              </T>
            </Pressable>
          }
        />
      </View>
      {multi && selected.length > 0 && (
        <View style={{ paddingHorizontal: space(4), paddingTop: space(2) }}>
          <Button
            testID="picker-add"
            label={`Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}`}
            onPress={() => {
              onPick(selected);
              close();
            }}
          />
        </View>
      )}
      <ExerciseForm
        visible={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onSaved={(ex) => {
          setCreating(false);
          if (multi) setSelected((s) => [...s, ex.id]);
          else {
            onPick([ex.id]);
            close();
          }
        }}
      />
    </Sheet>
  );
}

const KINDS: { value: ExerciseKind; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'reps', label: 'Reps' },
  { value: 'assisted', label: 'Assisted' },
  { value: 'time', label: 'Time' },
  { value: 'cardio', label: 'Cardio' },
];

export function ExerciseForm({
  visible,
  onClose,
  onSaved,
  initialName = '',
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (ex: Exercise) => void;
  initialName?: string;
  editing?: Exercise;
}) {
  const c = useTheme();
  const [name, setName] = useState(editing?.name ?? initialName);
  const [muscle, setMuscle] = useState<Muscle>(editing?.muscle ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(editing?.equipment ?? 'barbell');
  const [kind, setKind] = useState<ExerciseKind>(editing?.kind ?? 'weight');
  const [secondary, setSecondary] = useState<Muscle[]>(editing?.secondary ?? []);
  React.useEffect(() => {
    if (visible) {
      setName(editing?.name ?? initialName);
      setMuscle(editing?.muscle ?? 'chest');
      setEquipment(editing?.equipment ?? 'barbell');
      setKind(editing?.kind ?? 'weight');
      setSecondary(editing?.secondary ?? []);
    }
  }, [visible]);
  const save = () => {
    const fields = { name: name.trim(), muscle, equipment, kind, secondary: secondary.filter((m) => m !== muscle) };
    if (!fields.name) return;
    if (editing) {
      const ex = { ...editing, ...fields };
      saveExercise(ex);
      onSaved(ex);
    } else onSaved(createExercise(fields));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Edit exercise' : 'New exercise'} full>
      <SheetScroll>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Incline Press (Machine)" autoFocus={!editing} testID="exercise-name" />
        <T v="label" dim>
          Records
        </T>
        <Segmented options={KINDS} value={kind} onChange={setKind} />
        <T v="label" dim style={{ marginTop: space(2) }}>
          Primary muscle
        </T>
        <View style={styles.wrap}>
          {MUSCLES.map((m) => (
            <Chip key={m} label={cap(m)} active={muscle === m} onPress={() => setMuscle(m)} />
          ))}
        </View>
        <T v="label" dim style={{ marginTop: space(2) }}>
          Also works
        </T>
        <View style={styles.wrap}>
          {MUSCLES.filter((m) => m !== muscle).map((m) => (
            <Chip
              key={m}
              label={cap(m)}
              active={secondary.includes(m)}
              onPress={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
            />
          ))}
        </View>
        <T v="label" dim style={{ marginTop: space(2) }}>
          Equipment
        </T>
        <View style={styles.wrap}>
          {EQUIPMENT.map((e) => (
            <Chip key={e} label={equipmentLabel(e)} active={equipment === e} onPress={() => setEquipment(e)} />
          ))}
        </View>
        <Button label={editing ? 'Save' : 'Create exercise'} onPress={save} disabled={!name.trim()} style={{ marginTop: space(4) }} testID="exercise-save" />
        <T v="caption" faint center style={{ color: c.textFaint }}>
          Custom exercises get the same charts, records and coaching as built-in ones.
        </T>
      </SheetScroll>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    paddingHorizontal: space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.md, paddingHorizontal: space(3) },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(3), paddingHorizontal: space(2) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
