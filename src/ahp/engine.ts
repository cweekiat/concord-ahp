/**
 * AHP engine — pure, deterministic maths. No AI in here.
 * Everything the AI "explains" is first computed by these functions,
 * so numbers in the app never come from a language model.
 */

export type Matrix = number[][];

/** Saaty's 1–9 scale and reciprocals, ascending. */
export const SAATY_VALUES = [1 / 9, 1 / 8, 1 / 7, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Saaty's random consistency index by matrix size n (index = n). */
export const RANDOM_INDEX = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

export const CR_LIMIT = 0.1;

/** Upper-triangle pairs (i < j) in row-major order. */
export function pairIndex(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/** Build a reciprocal matrix from upper-triangle judgments a_ij (i<j). */
export function buildMatrix(n: number, upper: number[]): Matrix {
  const m: Matrix = Array.from({ length: n }, () => Array(n).fill(1));
  pairIndex(n).forEach(([i, j], k) => {
    const v = upper[k] ?? 1;
    m[i][j] = v;
    m[j][i] = 1 / v;
  });
  return m;
}

export function upperOf(m: Matrix): number[] {
  return pairIndex(m.length).map(([i, j]) => m[i][j]);
}

/** Principal right eigenvector by power iteration, normalised to sum 1. */
export function priorityVector(m: Matrix, maxIter = 200): number[] {
  const n = m.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  let w = Array(n).fill(1 / n);
  for (let k = 0; k < maxIter; k++) {
    const v = m.map((row) => row.reduce((s, a, j) => s + a * w[j], 0));
    const sum = v.reduce((a, b) => a + b, 0);
    const next = v.map((x) => x / sum);
    const diff = Math.max(...next.map((x, i) => Math.abs(x - w[i])));
    w = next;
    if (diff < 1e-13) break;
  }
  return w;
}

export interface Consistency {
  weights: number[];
  lambdaMax: number;
  ci: number;
  cr: number;
}

export function consistency(m: Matrix): Consistency {
  const n = m.length;
  const weights = priorityVector(m);
  if (n <= 2) return { weights, lambdaMax: n, ci: 0, cr: 0 };
  const mw = m.map((row) => row.reduce((s, a, j) => s + a * weights[j], 0));
  const lambdaMax = mw.reduce((s, x, i) => s + x / weights[i], 0) / n;
  const ci = (lambdaMax - n) / (n - 1);
  const ri = RANDOM_INDEX[n] ?? 1.49;
  return { weights, lambdaMax, ci, cr: Math.max(0, ci / ri) };
}

/** Nearest value on the Saaty scale, measured in log space. */
export function snapToSaaty(x: number): number {
  let best = 1;
  let bestD = Infinity;
  for (const v of SAATY_VALUES) {
    const d = Math.abs(Math.log(x) - Math.log(v));
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** A perfectly consistent judgment set implied by a weight vector, snapped to the Saaty scale. */
export function judgmentsFromWeights(w: number[]): number[] {
  return pairIndex(w.length).map(([i, j]) => snapToSaaty(w[i] / w[j]));
}

/**
 * Aggregation of Individual Judgments (AIJ): element-wise weighted geometric mean.
 * Keeps the reciprocal property, which is why AHP practice prefers it for groups.
 */
export function geometricMeanMatrix(ms: Matrix[], weights?: number[]): Matrix {
  if (ms.length === 0) throw new Error('No matrices to aggregate');
  const n = ms[0].length;
  const w = weights ?? ms.map(() => 1 / ms.length);
  const total = w.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => Math.exp(ms.reduce((s, m, k) => s + (w[k] / total) * Math.log(m[i][j]), 0))),
  );
}

export interface JudgmentFix {
  i: number;
  j: number;
  current: number;
  /** Value most in line with the rest of the matrix (lowest achievable CR for this pair). */
  suggested: number;
  /** Smallest move from `current` that brings CR within the limit, if one exists. */
  minimal: number | null;
  crBefore: number;
  crAfter: number;
  crAfterMinimal: number | null;
  /** a_ij * w_j / w_i — 1 means perfectly in line with the rest of the matrix. */
  deviation: number;
}

/**
 * Locate the judgment most responsible for inconsistency: the pair whose revision lowers CR
 * the most. Reports the best-fitting value and the smallest acceptable move, so the expert
 * can choose how far to go. It never changes anything itself.
 */
export function mostInconsistentJudgment(m: Matrix, limit = CR_LIMIT): JudgmentFix | null {
  const n = m.length;
  if (n < 3) return null;
  const base = consistency(m);
  let best: JudgmentFix | null = null;
  for (const [i, j] of pairIndex(n)) {
    const current = m[i][j];
    let bestV = current;
    let bestCr = base.cr;
    let minimal: number | null = null;
    let minimalMove = Infinity;
    let crMin: number | null = null;
    for (const v of SAATY_VALUES) {
      if (Math.abs(v - current) < 1e-9) continue;
      const trial = m.map((r) => r.slice());
      trial[i][j] = v;
      trial[j][i] = 1 / v;
      const cr = consistency(trial).cr;
      if (cr < bestCr) {
        bestCr = cr;
        bestV = v;
      }
      const move = Math.abs(Math.log(v) - Math.log(current));
      if (cr <= limit && move < minimalMove) {
        minimalMove = move;
        minimal = v;
        crMin = cr;
      }
    }
    if (!best || bestCr < best.crAfter) {
      best = {
        i,
        j,
        current,
        suggested: bestV,
        minimal,
        crBefore: base.cr,
        crAfter: bestCr,
        crAfterMinimal: crMin,
        deviation: (current * base.weights[j]) / base.weights[i],
      };
    }
  }
  return best;
}

/** Weighted sum: global[a] = Σ_c W[c] · S[c][a]. */
export function synthesize(W: number[], S: number[][]): number[] {
  const nAlt = S[0]?.length ?? 0;
  return Array.from({ length: nAlt }, (_, a) => W.reduce((s, w, c) => s + w * S[c][a], 0));
}

/**
 * One-at-a-time sensitivity on criterion k. Its weight is set to t ∈ [0,1] and the others
 * are rescaled proportionally. Each alternative's score is then linear in t.
 */
export function sensitivityLines(W: number[], S: number[][], k: number): Array<{ at0: number; at1: number }> {
  const nAlt = S[0].length;
  const rest = 1 - W[k];
  return Array.from({ length: nAlt }, (_, a) => {
    const others = rest <= 1e-12 ? 0 : W.reduce((s, w, c) => (c === k ? s : s + w * S[c][a]), 0) / rest;
    return { at0: others, at1: S[k][a] };
  });
}

export interface Crossover {
  t: number;
  a: number;
  b: number;
}

/** Weights of criterion k at which two alternatives tie (rank reversals). */
export function crossovers(W: number[], S: number[][], k: number): Crossover[] {
  const lines = sensitivityLines(W, S, k);
  const out: Crossover[] = [];
  for (let a = 0; a < lines.length; a++)
    for (let b = a + 1; b < lines.length; b++) {
      const da0 = lines[a].at0 - lines[b].at0;
      const da1 = lines[a].at1 - lines[b].at1;
      const denom = da0 - da1;
      if (Math.abs(denom) < 1e-12) continue;
      const t = da0 / denom;
      if (t > 0 && t < 1) out.push({ t, a, b });
    }
  return out.sort((x, y) => x.t - y.t);
}

export function scoreAt(line: { at0: number; at1: number }, t: number): number {
  return line.at0 + (line.at1 - line.at0) * t;
}

/**
 * Value function for a measured criterion: threshold → floor, objective → 1, linear between,
 * no extra credit beyond the objective (DoD threshold/objective convention).
 * Works for lower-is-better because objective < threshold flips the sign.
 */
export function valueScore(x: number, threshold: number, objective: number, floor = 0.1): number {
  const t = (x - threshold) / (objective - threshold);
  return floor + (1 - floor) * Math.min(1, Math.max(0, t));
}

export function meetsThreshold(x: number, threshold: number, direction: 'higher' | 'lower'): boolean {
  return direction === 'higher' ? x >= threshold : x <= threshold;
}

export function normalize(v: number[]): number[] {
  const s = v.reduce((a, b) => a + b, 0);
  return s === 0 ? v.map(() => 0) : v.map((x) => x / s);
}

/** Slider position (−8…8, negative favours the left item) ↔ judgment a_ij. */
export function judgmentToPosition(a: number): number {
  return a >= 1 ? -(Math.round(a) - 1) : Math.round(1 / a) - 1;
}
export function positionToJudgment(p: number): number {
  return p <= 0 ? 1 - p : 1 / (1 + p);
}

export const INTENSITY_LABELS: Record<number, string> = {
  1: 'equally important',
  2: 'equally to moderately more important',
  3: 'moderately more important',
  4: 'moderately to strongly more important',
  5: 'strongly more important',
  6: 'strongly to very strongly more important',
  7: 'very strongly more important',
  8: 'very strongly to extremely more important',
  9: 'extremely more important',
};

export function formatJudgment(a: number): string {
  return a >= 1 ? String(Math.round(a)) : `1/${Math.round(1 / a)}`;
}
