// Unit conversion and number formatting.

import type { Unit } from './types.ts';

export const LB_PER_KG = 2.2046226218;

export function toDisplay(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG;
}

export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

/** Round to the nearest multiple of `step`, avoiding float dust like 62.50000001. */
export function roundTo(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

/**
 * A weight for display. A value entered in pounds and stored in kg must come
 * back as exactly what was typed, so we round to 0.01 then trim zeros.
 */
export function fmtNum(value: number | undefined, maxDecimals = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  const fixed = value.toFixed(maxDecimals);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

export function fmtWeight(kg: number | undefined, unit: Unit): string {
  if (kg === undefined) return '';
  return fmtNum(toDisplay(kg, unit), unit === 'kg' ? 2 : 1);
}

/** An estimate (1RM, trend) is never precise to the gram: one decimal. */
export function fmtEst(kg: number | undefined, unit: Unit): string {
  if (kg === undefined) return '';
  return fmtNum(toDisplay(kg, unit), 1);
}

/** Big numbers for totals: 12,450 kg, 1.2M lb. */
export function fmtBig(value: number): string {
  if (value >= 1e6) return fmtNum(value / 1e6, 2) + 'M';
  if (value >= 1000) return Math.round(value).toLocaleString('en-US');
  return fmtNum(value, 1);
}

/** 3725 → "1:02:05", 95 → "1:35". */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`;
}

/** 3725 → "1h 2m", 300 → "5m". */
export function fmtDuration(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Parse what a person types into a number field: "62,5" counts. */
export function parseNum(text: string): number | undefined {
  const cleaned = text.replace(',', '.').trim();
  if (cleaned === '' || cleaned === '.') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Default load step for the coach: what a typical gym lets you add. */
export function defaultIncrementKg(equipment: string, unit: Unit): number {
  if (unit === 'lb') return 5 / LB_PER_KG;
  if (equipment === 'dumbbell' || equipment === 'kettlebell') return 2;
  return 2.5;
}

/** The smallest weight step worth showing in this unit. */
export function displayStep(unit: Unit): number {
  return unit === 'kg' ? 0.25 : 0.5;
}
