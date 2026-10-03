// Visual language.
//
// A gym is loud, bright and sweaty, and the phone is propped on a bench two
// metres away. So: big numerals, high contrast, one electric accent for "this
// is done" and "this is progress", and tap targets you can hit with chalk on
// your fingers. Dark is the default look; light is there for daylight.

import { createContext, useContext } from 'react';

export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  raised: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  done: string;
  doneText: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  warmup: string;
  drop: string;
  failure: string;
  info: string;
  overlay: string;
}

export const DARK: Palette = {
  dark: true,
  bg: '#0B0C0E',
  surface: '#15171A',
  surfaceAlt: '#1D2024',
  raised: '#24282D',
  border: '#2A2E34',
  text: '#F4F5F6',
  textDim: '#A3A9B1',
  textFaint: '#6A717B',
  accent: '#C8F031',
  accentSoft: '#26300F',
  accentText: '#0B0C0E',
  done: '#1E2A10',
  doneText: '#C8F031',
  gold: '#FFC845',
  goldSoft: '#3A2E10',
  danger: '#FF5A4E',
  dangerSoft: '#3A1512',
  warmup: '#FFB547',
  drop: '#62B6FF',
  failure: '#FF6B8B',
  info: '#62B6FF',
  overlay: 'rgba(0,0,0,0.6)',
};

export const LIGHT: Palette = {
  dark: false,
  bg: '#F3F4F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0EC',
  raised: '#E4E7E1',
  border: '#DDE1DA',
  text: '#121410',
  textDim: '#59605A',
  textFaint: '#8E958F',
  accent: '#4D7A00',
  accentSoft: '#E5F2CC',
  accentText: '#FFFFFF',
  done: '#E8F5D2',
  doneText: '#3B6100',
  gold: '#B07800',
  goldSoft: '#FBEFCF',
  danger: '#D33A2F',
  dangerSoft: '#FBE3E0',
  warmup: '#C27400',
  drop: '#1F74C9',
  failure: '#C9305A',
  info: '#1F74C9',
  overlay: 'rgba(0,0,0,0.35)',
};

export const ThemeContext = createContext<Palette>(DARK);

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

export const space = (n: number) => n * 4;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const type = {
  hero: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1.2 },
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
  smallStrong: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.3 },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.9, textTransform: 'uppercase' as const },
};

/** Tabular figures so columns of weights line up and timers do not jitter. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

export function fmtDate(at: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Date(at).toLocaleDateString(undefined, opts);
}

export function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Yesterday", "Tue", "12 Mar", "12 Mar 2024". */
export function relativeDay(at: number, now = Date.now()): string {
  const a = new Date(at);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7 && days > 0) return a.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = a.getFullYear() === b.getFullYear();
  return a.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}
