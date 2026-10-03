// Settings, plates, and moving your data in and out.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { exportCsv, importCsv, type ImportResult } from '../../core/csv.ts';
import type { Unit } from '../../core/types.ts';
import { fmtNum, fromDisplay, parseNum, toDisplay } from '../../core/units.ts';
import { pickTextFile, shareTextFile } from '../../platform/files.ts';
import {
  eraseEverything,
  getState,
  importData,
  replaceDatabase,
  updateSettings,
  useStore,
} from '../../state/store.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { afterModal, ask, Button, Card, confirm, Divider, SectionLabel, Segmented, Sheet, SheetScroll, T, toast } from '../kit.tsx';
import { Body, Header } from '../Screen.tsx';
import { PlateCalculator } from '../tools.tsx';
import { radius, space, useTheme } from '../theme.ts';

function SettingRow({ icon, label, sub, right, onPress }: { icon: IconName; label: string; sub?: string; right?: React.ReactNode; onPress?: () => void }) {
  const c = useTheme();
  const body = (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: c.surfaceAlt }]}>
        <Icon name={icon} size={18} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{label}</T>
        {sub ? (
          <T v="small" dim>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function SettingsScreen() {
  const c = useTheme();
  const settings = useStore((s) => s.db.settings);
  const workoutCount = useStore((s) => s.db.workouts.length);
  const unit = settings.unit;
  const [plates, setPlates] = useState(false);
  const [calc, setCalc] = useState(false);
  const [preview, setPreview] = useState<{ result: ImportResult; text: string } | null>(null);

  const startImport = async () => {
    try {
      const file = await pickTextFile();
      if (!file) return;
      // The document picker is itself a modal that is still animating away.
      await new Promise<void>((r) => afterModal(r));
      if (file.name.toLowerCase().endsWith('.json')) {
        restoreBackup(file.text);
        return;
      }
      const s = getState();
      const result = importCsv(file.text, s.db.exercises, s.db.workouts, unit);
      if (!result.workouts.length) {
        ask('Nothing to import', result.skippedDuplicates ? `All ${result.skippedDuplicates} workouts in this file are already in your history.` : result.warnings.join(' ') || 'No workouts found.', [{ label: 'OK' }]);
        return;
      }
      setPreview({ result, text: file.text });
    } catch (e) {
      ask('Could not read the file', String((e as Error).message ?? e), [{ label: 'OK' }]);
    }
  };

  const restoreBackup = (text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      ask('Not a backup file', 'The file could not be read as a backup.', [{ label: 'OK' }]);
      return;
    }
    confirm('Restore this backup?', 'Everything currently in the app will be replaced by the backup.', 'Restore', () => {
      if (replaceDatabase(parsed)) toast('Backup restored', 'check');
      else ask('Not a backup file', 'The file does not contain workouts.', [{ label: 'OK' }]);
    });
  };

  const exportAll = async () => {
    const s = getState();
    if (!s.db.workouts.length) {
      toast('No workouts to export yet', 'info');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    await shareTextFile(`overload-workouts-${stamp}.csv`, exportCsv(s.db.workouts, s.exercises, unit), 'text/csv');
  };

  const backup = async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    await shareTextFile(`overload-backup-${stamp}.json`, JSON.stringify(getState().db), 'application/json');
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Settings" back />
      <Body>
        <SectionLabel>Units and equipment</SectionLabel>
        <Card>
          <Segmented<Unit>
            options={[
              { value: 'kg', label: 'Kilograms' },
              { value: 'lb', label: 'Pounds' },
            ]}
            value={unit}
            onChange={(u) => updateSettings({ unit: u })}
          />
          <T v="caption" faint style={{ marginTop: space(2), marginBottom: space(2) }}>
            Switching only changes what you see. History is stored exactly, so nothing is rounded.
          </T>
          <Divider />
          <SettingRow
            icon="dumbbell"
            label="Bar weight"
            right={
              <NumberBox
                value={fmtNum(toDisplay(settings.barKg, unit), 2)}
                suffix={unit}
                onCommit={(v) => updateSettings({ barKg: fromDisplay(v, unit) })}
              />
            }
          />
          <SettingRow icon="list" label="Plates you have" sub={settings.plates.filter((p) => p.pairs > 0).map((p) => fmtNum(p.weight)).join(' · ')} onPress={() => setPlates(true)} right={<Icon name="chevron" size={16} color={c.textFaint} />} />
          <SettingRow icon="calc" label="Plate calculator" onPress={() => setCalc(true)} right={<Icon name="chevron" size={16} color={c.textFaint} />} />
        </Card>

        <SectionLabel>Training</SectionLabel>
        <Card>
          <SettingRow
            icon="timer"
            label="Rest timer"
            sub="After each completed set. Change per exercise from its menu."
            right={<NumberBox value={String(settings.restSec)} suffix="s" onCommit={(v) => updateSettings({ restSec: Math.round(v) })} />}
          />
          <SettingRow
            icon="target"
            label="Weekly sets per muscle"
            sub="The target on the Progress tab"
            right={<NumberBox value={String(settings.weeklySetTarget)} onCommit={(v) => updateSettings({ weeklySetTarget: Math.max(1, Math.round(v)) })} />}
          />
          <SettingRow
            icon="bolt"
            label="Count RPE in 1RM estimates"
            sub="A set at RPE 8 counts the two reps you had left"
            right={<Switch value={settings.rpeAdjust} onValueChange={(v) => updateSettings({ rpeAdjust: v })} trackColor={{ true: c.accent }} thumbColor="#FFFFFF" />}
          />
          <SettingRow
            icon="calendar"
            label="Week starts on"
            right={
              <View style={{ width: 150 }}>
                <Segmented
                  options={[
                    { value: '1', label: 'Mon' },
                    { value: '0', label: 'Sun' },
                  ]}
                  value={String(settings.weekStart)}
                  onChange={(v) => updateSettings({ weekStart: v === '1' ? 1 : 0 })}
                />
              </View>
            }
          />
        </Card>

        <SectionLabel>App</SectionLabel>
        <Card>
          <Segmented
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            value={settings.theme}
            onChange={(t) => updateSettings({ theme: t as 'system' | 'dark' | 'light' })}
          />
          <SettingRow icon="bolt" label="Haptics" right={<Switch value={settings.haptics} onValueChange={(v) => updateSettings({ haptics: v })} trackColor={{ true: c.accent }} thumbColor="#FFFFFF" />} />
          <SettingRow
            icon="info"
            label="Keep screen on during workouts"
            right={<Switch value={settings.keepAwake} onValueChange={(v) => updateSettings({ keepAwake: v })} trackColor={{ true: c.accent }} thumbColor="#FFFFFF" />}
          />
        </Card>

        <SectionLabel>Your data</SectionLabel>
        <Card>
          <SettingRow icon="download" label="Import from Strong or Hevy" sub="Pick the CSV you exported from the other app" onPress={startImport} />
          <SettingRow icon="upload" label="Export workouts as CSV" sub="Strong-compatible, opens in any spreadsheet" onPress={exportAll} />
          <SettingRow icon="copy" label="Back up everything" sub="One file with workouts, routines, body stats and settings" onPress={backup} />
          <SettingRow icon="history" label="Restore a backup" onPress={async () => {
            const f = await pickTextFile();
            if (f) afterModal(() => restoreBackup(f.text));
          }} />
          <T v="caption" faint style={{ marginTop: space(2) }}>
            Everything lives on this phone. No account, no server, nothing is uploaded. Back up now and then, and keep the file somewhere safe.
          </T>
        </Card>

        <Button
          label="Erase all data"
          kind="danger"
          style={{ marginTop: space(6) }}
          onPress={() =>
            confirm('Erase everything?', `${workoutCount} workouts, every routine and measurement will be deleted from this phone. This cannot be undone.`, 'Erase everything', () => {
              eraseEverything();
              toast('All data erased', 'check');
            })
          }
        />
        <T v="caption" faint center style={{ marginTop: space(6) }}>
          Overload {Constants.expoConfig?.version ?? ''} · every feature, no subscription
        </T>
      </Body>

      <Sheet visible={plates} onClose={() => setPlates(false)} title="Plates you have">
        <SheetScroll>
          <T v="small" dim>
            Pairs of each plate. The plate calculator and warm-ups only use what you own.
          </T>
          {settings.plates.map((p, i) => (
            <View key={i} style={styles.plateRow}>
              <T v="bodyStrong" style={{ flex: 1 }}>
                {fmtNum(p.weight)} {unit}
              </T>
              <Stepper
                value={p.pairs}
                onChange={(n) => updateSettings({ plates: settings.plates.map((q, j) => (j === i ? { ...q, pairs: Math.max(0, n) } : q)) })}
              />
            </View>
          ))}
          <AddPlate onAdd={(w) => updateSettings({ plates: [...settings.plates, { weight: w, pairs: 1 }].sort((a, b) => b.weight - a.weight) })} />
        </SheetScroll>
      </Sheet>

      <Sheet visible={calc} onClose={() => setCalc(false)} title="Plate calculator">
        <SheetScroll>
          <PlateCalculator />
        </SheetScroll>
      </Sheet>

      <Sheet visible={!!preview} onClose={() => setPreview(null)} title="Import">
        {preview ? (
          <SheetScroll>
            <T v="title">
              {preview.result.workouts.length} workouts · {preview.result.sets} sets
            </T>
            <T dim>
              From {preview.result.source === 'strong' ? 'Strong' : 'Hevy'}, {new Date(preview.result.workouts[0].start).toLocaleDateString()} to{' '}
              {new Date(preview.result.workouts[preview.result.workouts.length - 1].start).toLocaleDateString()}.
            </T>
            {preview.result.skippedDuplicates ? <T v="small" dim>{preview.result.skippedDuplicates} already in your history will be skipped.</T> : null}
            {preview.result.newExercises.length ? (
              <T v="small" dim>
                {preview.result.newExercises.length} exercise{preview.result.newExercises.length > 1 ? 's were' : ' was'} not in the library and will be added as custom:{' '}
                {preview.result.newExercises.slice(0, 8).map((e) => e.name).join(', ')}
                {preview.result.newExercises.length > 8 ? '…' : ''}
              </T>
            ) : null}
            <T v="label" dim style={{ marginTop: space(2) }}>
              Weights in this file are in
            </T>
            <Segmented<Unit>
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
              value={preview.result.unit}
              onChange={(u) => {
                const s = getState();
                setPreview({ text: preview.text, result: importCsv(preview.text, s.db.exercises, s.db.workouts, u) });
              }}
            />
            <Button
              label="Import"
              icon="download"
              style={{ marginTop: space(3) }}
              testID="confirm-import"
              onPress={() => {
                importData(preview.result.workouts, preview.result.newExercises);
                toast(`Imported ${preview.result.workouts.length} workouts`, 'check');
                setPreview(null);
              }}
            />
          </SheetScroll>
        ) : null}
      </Sheet>
    </View>
  );
}

function NumberBox({ value, onCommit, suffix }: { value: string; onCommit: (v: number) => void; suffix?: string }) {
  const c = useTheme();
  const [text, setText] = useState(value);
  React.useEffect(() => setText(value), [value]);
  return (
    <View style={[styles.numBox, { backgroundColor: c.surfaceAlt }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const n = parseNum(text);
          if (n !== undefined) onCommit(n);
          else setText(value);
        }}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={{ color: c.text, fontSize: 16, fontWeight: '700', width: 56, textAlign: 'right', paddingVertical: space(1.5) }}
      />
      {suffix ? (
        <T v="small" dim>
          {suffix}
        </T>
      ) : null}
    </View>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <Pressable style={[styles.step, { backgroundColor: c.surfaceAlt }]} onPress={() => onChange(value - 1)} accessibilityLabel="Fewer">
        <Icon name="minus" size={16} color={c.text} />
      </Pressable>
      <T v="bodyStrong" style={{ width: 28, textAlign: 'center' }}>
        {value}
      </T>
      <Pressable style={[styles.step, { backgroundColor: c.surfaceAlt }]} onPress={() => onChange(value + 1)} accessibilityLabel="More">
        <Icon name="plus" size={16} color={c.text} />
      </Pressable>
    </View>
  );
}

function AddPlate({ onAdd }: { onAdd: (w: number) => void }) {
  const c = useTheme();
  const [text, setText] = useState('');
  return (
    <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center', marginTop: space(2) }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Another plate weight"
        placeholderTextColor={c.textFaint}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space(3), fontSize: 16 }}
      />
      <Button
        label="Add"
        small
        kind="secondary"
        onPress={() => {
          const n = parseNum(text);
          if (n && n > 0) {
            onAdd(n);
            setText('');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numBox: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: space(2.5) },
  plateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(1.5) },
  step: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
