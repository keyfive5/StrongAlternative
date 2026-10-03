// Charts, drawn directly with react-native-svg.

import React, { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { T } from './kit.tsx';
import { space, useTheme } from './theme.ts';

/** SVG text falls back to a serif on web unless told otherwise. */
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

export interface Point {
  date: number;
  value: number;
}

function useWidth(initial = 320): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(initial);
  return [w, (e) => setW(Math.max(100, Math.round(e.nativeEvent.layout.width)))];
}

function niceRange(min: number, max: number): [number, number] {
  if (min === max) return [min * 0.9, max * 1.1 || 1];
  const pad = (max - min) * 0.12;
  return [Math.max(0, min - pad), max + pad];
}

/**
 * A line over time with a soft fill. Tap or drag across it to read any point;
 * the latest point is labelled by default.
 */
export function LineChart({
  points,
  height = 180,
  format,
  color,
  testID,
}: {
  points: Point[];
  height?: number;
  format: (v: number) => string;
  color?: string;
  testID?: string;
}) {
  const c = useTheme();
  const stroke = color ?? c.accent;
  const [width, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 28;
  const PAD_B = 22;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const xs = points.map((p) => p.date);
    const ys = points.map((p) => p.value);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const [y0, y1] = niceRange(Math.min(...ys), Math.max(...ys));
    const w = width - PAD_L - PAD_R;
    const h = height - PAD_T - PAD_B;
    const sx = (x: number) => PAD_L + (x1 === x0 ? w / 2 : ((x - x0) / (x1 - x0)) * w);
    const sy = (y: number) => PAD_T + h - ((y - y0) / (y1 - y0)) * h;
    const pts = points.map((p) => ({ x: sx(p.date), y: sy(p.value), p }));
    const line = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${PAD_T + h} L${pts[0].x.toFixed(1)},${PAD_T + h} Z`;
    return { pts, line, area, y0, y1, h, x0, x1 };
  }, [points, width, height]);

  if (!geo) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
        <T dim v="small">
          No data yet
        </T>
      </View>
    );
  }
  const idx = sel ?? geo.pts.length - 1;
  const focus = geo.pts[idx];
  const labelX = Math.min(Math.max(focus.x, 60), width - 60);
  const bestIdx = geo.pts.reduce((b, q, i) => (q.p.value > geo.pts[b].p.value ? i : b), 0);

  const pick = (x: number) => {
    let best = 0;
    for (let i = 1; i < geo.pts.length; i++) if (Math.abs(geo.pts[i].x - x) < Math.abs(geo.pts[best].x - x)) best = i;
    setSel(best);
  };

  return (
    <View onLayout={onLayout} testID={testID}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((f) => (
          <Line
            key={f}
            x1={PAD_L}
            x2={width - PAD_R}
            y1={PAD_T + geo.h * f}
            y2={PAD_T + geo.h * f}
            stroke={c.border}
            strokeWidth={1}
            strokeDasharray={f === 1 ? undefined : '3,5'}
          />
        ))}
        <Path d={geo.area} fill="url(#fill)" />
        <Path d={geo.line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {geo.pts.length <= 40 &&
          geo.pts.map((q, i) => <Circle key={i} cx={q.x} cy={q.y} r={2.6} fill={c.surface} stroke={stroke} strokeWidth={1.6} />)}
        {bestIdx !== idx && (
          <Circle cx={geo.pts[bestIdx].x} cy={geo.pts[bestIdx].y} r={4.5} fill={c.gold} stroke={c.surface} strokeWidth={1.5} />
        )}
        <Line x1={focus.x} x2={focus.x} y1={PAD_T - 4} y2={PAD_T + geo.h} stroke={c.textFaint} strokeWidth={1} />
        <Circle cx={focus.x} cy={focus.y} r={6} fill={stroke} stroke={c.surface} strokeWidth={2.5} />
        <SvgText fontFamily={FONT} x={labelX} y={14} fontSize={13} fontWeight="700" fill={c.text} textAnchor="middle">
          {format(focus.p.value)}
        </SvgText>
        <SvgText fontFamily={FONT} x={labelX} y={height - 6} fontSize={11} fill={c.textDim} textAnchor="middle">
          {new Date(focus.p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}
        </SvgText>
      </Svg>
      <Pressable
        accessibilityLabel="Chart. Tap to read a point."
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        onPress={(e) => pick(e.nativeEvent.locationX)}
        onTouchMove={(e) => pick(e.nativeEvent.locationX)}
      />
    </View>
  );
}

/** Vertical bars with a label per bar. */
export function BarChart({
  values,
  labels,
  height = 150,
  format,
  highlightLast = true,
  target,
}: {
  values: number[];
  labels: string[];
  height?: number;
  format: (v: number) => string;
  highlightLast?: boolean;
  target?: number;
}) {
  const c = useTheme();
  const [width, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...values, target ?? 0);
  const PAD_T = 22;
  const PAD_B = 20;
  const h = height - PAD_T - PAD_B;
  const n = values.length || 1;
  const slot = width / n;
  const bw = Math.min(28, slot * 0.62);
  const idx = sel ?? values.length - 1;
  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        {target !== undefined && (
          <Line x1={0} x2={width} y1={PAD_T + h - (target / max) * h} y2={PAD_T + h - (target / max) * h} stroke={c.textFaint} strokeDasharray="4,4" />
        )}
        {values.map((v, i) => {
          const bh = Math.max(v > 0 ? 3 : 0, (v / max) * h);
          const x = i * slot + (slot - bw) / 2;
          const on = i === idx;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={PAD_T + h - bh} width={bw} height={bh} rx={Math.min(6, bw / 3)} fill={on && highlightLast ? c.accent : c.raised} />
              {(n <= 12 || i % Math.ceil(n / 8) === 0 || i === n - 1) && (
                <SvgText fontFamily={FONT} x={x + bw / 2} y={height - 5} fontSize={10} fill={c.textFaint} textAnchor="middle">
                  {labels[i]}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
        {values.length > 0 && (
          <SvgText
            fontFamily={FONT}
            x={Math.min(Math.max(idx * slot + slot / 2, 40), width - 40)}
            y={14}
            fontSize={12}
            fontWeight="700"
            fill={c.text}
            textAnchor="middle"
          >
            {format(values[idx])}
          </SvgText>
        )}
      </Svg>
      <Pressable
        accessibilityLabel="Bar chart. Tap a bar to read it."
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        onPress={(e) => setSel(Math.min(n - 1, Math.max(0, Math.floor(e.nativeEvent.locationX / slot))))}
      />
    </View>
  );
}

/** A year of training days as a grid of squares, one column per week. */
export function CalendarHeat({ days, weeks = 26, weekStart = 1 }: { days: Map<number, number>; weeks?: number; weekStart?: 0 | 1 }) {
  const c = useTheme();
  const [width, onLayout] = useWidth();
  const gap = 3;
  const cell = Math.max(6, Math.min(16, Math.floor((width - gap * (weeks - 1)) / weeks)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = (today.getDay() - weekStart + 7) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - offset - (weeks - 1) * 7);
  const cells: { x: number; y: number; v: number; future: boolean }[] = [];
  for (let wk = 0; wk < weeks; wk++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + wk * 7 + d);
      cells.push({ x: wk * (cell + gap), y: d * (cell + gap), v: days.get(day.getTime()) ?? 0, future: day > today });
    }
  }
  const h = 7 * (cell + gap) - gap;
  return (
    <View onLayout={onLayout} style={{ gap: space(1) }}>
      <Svg width={weeks * (cell + gap)} height={h}>
        {cells.map((q, i) => (
          <Rect
            key={i}
            x={q.x}
            y={q.y}
            width={cell}
            height={cell}
            rx={3}
            fill={q.future ? 'transparent' : q.v > 0 ? c.accent : c.surfaceAlt}
            opacity={q.v > 1 ? 1 : q.v > 0 ? 0.8 : 1}
          />
        ))}
      </Svg>
    </View>
  );
}

/** A thin horizontal meter, e.g. weekly sets against a target. */
export function Meter({ value, max, color }: { value: number; max: number; color?: string }) {
  const c = useTheme();
  const f = Math.max(0, Math.min(1, value / Math.max(1e-9, max)));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${f * 100}%`, height: '100%', borderRadius: 4, backgroundColor: color ?? c.accent }} />
    </View>
  );
}
