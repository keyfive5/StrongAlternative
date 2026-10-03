// Plate maths and warm-up ramps. Everything here works in the display unit,
// because plates are physical objects labelled in one unit or the other.

export interface PlateLoad {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs with these plates. */
  total: number;
  /** target - total; non-zero when the target cannot be built exactly. */
  remainder: number;
}

/**
 * Plates per side for a target. Greedy is optimal for every real-world plate
 * set (each plate is at least the sum of the smaller ones it replaces), and it
 * respects how many pairs of each plate the gym actually has.
 */
export function loadBar(target: number, bar: number, plates: { weight: number; pairs: number }[]): PlateLoad {
  const perSide: number[] = [];
  let side = (target - bar) / 2;
  if (side < 0) return { perSide, total: bar, remainder: target - bar };
  const sorted = [...plates].filter((p) => p.weight > 0 && p.pairs > 0).sort((a, b) => b.weight - a.weight);
  for (const p of sorted) {
    let n = 0;
    while (n < p.pairs && side + 1e-9 >= p.weight) {
      perSide.push(p.weight);
      side -= p.weight;
      n++;
    }
  }
  const total = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, total: Math.round(total * 1000) / 1000, remainder: Math.round((target - total) * 1000) / 1000 };
}

/** The nearest weight at or below `target` that the plates can actually make. */
export function nearestLoadable(target: number, bar: number, plates: { weight: number; pairs: number }[]): number {
  return loadBar(target, bar, plates).total;
}

export interface WarmupSet {
  weight: number;
  reps: number;
  /** Fraction of the working weight. */
  pct: number;
}

/**
 * A warm-up ramp toward a working weight: the empty bar, then roughly 40%, 60%,
 * 75% and 85%, with reps falling as load rises so the warm-up primes rather
 * than tires. Steps that would round to a duplicate weight are dropped.
 */
export function warmupRamp(
  working: number,
  bar: number,
  plates: { weight: number; pairs: number }[],
  usesBar = true,
): WarmupSet[] {
  if (!(working > 0)) return [];
  const steps: [number, number][] = [
    [0.4, 5],
    [0.6, 3],
    [0.75, 2],
    [0.85, 1],
  ];
  const out: WarmupSet[] = [];
  if (usesBar && working > bar * 1.5) out.push({ weight: bar, reps: 10, pct: bar / working });
  for (const [pct, reps] of steps) {
    const raw = working * pct;
    const w = usesBar ? nearestLoadable(raw, bar, plates) : Math.round(raw);
    if (w <= 0 || w >= working) continue;
    if (usesBar && w <= bar) continue;
    if (out.some((s) => Math.abs(s.weight - w) < 1e-6)) continue;
    // Light working weights need fewer ramp steps.
    if (working < bar * 2 && pct < 0.6) continue;
    out.push({ weight: w, reps, pct: w / working });
  }
  return out;
}
