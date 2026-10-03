// Plate calculator and warm-up calculator.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { loadBar, warmupRamp } from '../core/plates.ts';
import { fmtNum, parseNum, toDisplay } from '../core/units.ts';
import { useStore } from '../state/store.ts';
import { Field, T } from './kit.tsx';
import { radius, space, useTheme } from './theme.ts';

/** Plate colours follow the competition convention where there is one. */
function plateColor(w: number, unit: 'kg' | 'lb', dark: boolean): string {
  const kg = unit === 'kg' ? w : w / 2.2046;
  if (kg >= 24) return '#D8343A';
  if (kg >= 19) return '#2F6FD6';
  if (kg >= 14) return '#E8B923';
  if (kg >= 9) return '#2E9E57';
  if (kg >= 4.5) return dark ? '#E9E9E9' : '#5B6168';
  return dark ? '#8C939C' : '#9AA1A9';
}

export function BarDiagram({ perSide, unit }: { perSide: number[]; unit: 'kg' | 'lb' }) {
  const c = useTheme();
  const max = unit === 'kg' ? 25 : 45;
  const W = 300;
  const H = 110;
  let x = 112;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={H / 2 - 5} width={W} height={10} rx={3} fill={c.textFaint} />
      <Rect x={96} y={H / 2 - 13} width={14} height={26} rx={3} fill={c.textDim} />
      {perSide.map((p, i) => {
        const h = 34 + (p / max) * 66;
        const w = Math.max(7, Math.min(18, 6 + (p / max) * 12));
        const r = <Rect key={i} x={x} y={H / 2 - h / 2} width={w} height={h} rx={3} fill={plateColor(p, unit, c.dark)} />;
        x += w + 2;
        return r;
      })}
    </Svg>
  );
}

export function PlateCalculator({ initialKg }: { initialKg?: number }) {
  const c = useTheme();
  const settings = useStore((s) => s.db.settings);
  const unit = settings.unit;
  const bar = Math.round(toDisplay(settings.barKg, unit) * 100) / 100;
  const [text, setText] = useState(initialKg ? fmtNum(toDisplay(initialKg, unit), 2) : '');
  const target = parseNum(text) ?? 0;
  const load = loadBar(target, bar, settings.plates);
  const ramp = target > bar ? warmupRamp(target, bar, settings.plates) : [];
  return (
    <View style={{ gap: space(3) }}>
      <Field
        label={`Target weight (${unit})`}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        placeholder={`e.g. ${unit === 'kg' ? 100 : 225}`}
        testID="plate-target"
      />
      <View style={[styles.panel, { backgroundColor: c.surfaceAlt }]}>
        <BarDiagram perSide={load.perSide} unit={unit} />
        <T v="label" dim center>
          Each side
        </T>
        <T v="title" center>
          {load.perSide.length ? load.perSide.map((p) => fmtNum(p)).join('  ·  ') : target > 0 && target <= bar ? 'Just the bar' : '—'}
        </T>
        <T v="small" dim center>
          Bar {fmtNum(bar)} {unit}
          {load.remainder > 0.001 && target > bar
            ? ` · closest you can load is ${fmtNum(load.total)} ${unit} (${fmtNum(load.remainder)} short)`
            : ''}
        </T>
      </View>
      {ramp.length > 0 && (
        <View style={{ gap: space(1.5) }}>
          <T v="label" dim>
            Warm-up ramp
          </T>
          {ramp.map((s, i) => (
            <View key={i} style={[styles.rampRow, { borderBottomColor: c.border }]}>
              <T v="bodyStrong" style={{ width: 90 }}>
                {fmtNum(s.weight)} {unit}
              </T>
              <T dim style={{ width: 60 }}>
                × {s.reps}
              </T>
              <T v="small" faint style={{ flex: 1, textAlign: 'right' }}>
                {loadBar(s.weight, bar, settings.plates).perSide.map((p) => fmtNum(p)).join(' + ') || 'bar'}
              </T>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, padding: space(4), gap: space(1) },
  rampRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2), borderBottomWidth: StyleSheet.hairlineWidth },
});
