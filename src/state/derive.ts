import {
  CR_LIMIT,
  buildMatrix,
  consistency,
  geometricMeanMatrix,
  meetsThreshold,
  normalize,
  priorityVector,
  synthesize,
  valueScore,
  type Matrix,
} from '../ahp/engine';
import { ALTERNATIVES, CRITERIA, JUDGES, QUANT_LEAVES, type AltId, type CriterionId, type Expert, type Leaf } from '../data/scenario';
import { cellKey, type State } from './types';

export interface IndividualResult {
  expert: Expert;
  matrix: Matrix;
  weights: number[];
  cr: number;
}

export interface ScreenResult {
  alt: AltId;
  status: 'pass' | 'fail' | 'unknown';
  failures: Leaf[];
}

export interface Divergence {
  criterion: CriterionId;
  cv: number;
  low: { expert: Expert; w: number };
  high: { expert: Expert; w: number };
}

export interface Model {
  individuals: IndividualResult[];
  included: IndividualResult[];
  groupMatrix: Matrix;
  W: number[];
  groupCR: number;
  localWeights: Record<CriterionId, number[]>;
  areaCR: Partial<Record<CriterionId, number>>;
  qualCR: Record<string, number>;
  screening: ScreenResult[];
  active: AltId[];
  evidenceVerified: number;
  evidenceTotal: number;
  ready: boolean;
  blockers: string[];
  leafPriorities: Record<string, number[]>;
  S: number[][];
  global: number[];
  ranking: Array<{ alt: AltId; score: number }>;
  divergence: Divergence[];
}

const ALL: AltId[] = ALTERNATIVES.map((a) => a.id);

export function computeModel(s: State): Model {
  const individuals: IndividualResult[] = JUDGES.map((expert) => {
    const matrix = buildMatrix(CRITERIA.length, s.judgments[expert.id]);
    const c = consistency(matrix);
    return { expert, matrix, weights: c.weights, cr: c.cr };
  });
  let included = s.excludeInconsistent ? individuals.filter((x) => x.cr <= CR_LIMIT) : individuals;
  if (included.length === 0) included = individuals;
  const groupMatrix = geometricMeanMatrix(included.map((x) => x.matrix));
  const g = consistency(groupMatrix);

  const localWeights = {} as Record<CriterionId, number[]>;
  const areaCR: Partial<Record<CriterionId, number>> = {};
  for (const c of CRITERIA) {
    if (c.leaves.length < 2) {
      localWeights[c.id] = [1];
      continue;
    }
    const cc = consistency(buildMatrix(c.leaves.length, s.area[c.id] ?? []));
    localWeights[c.id] = cc.weights;
    areaCR[c.id] = cc.cr;
  }

  // Screening against KPP thresholds — only from verified evidence.
  const screening: ScreenResult[] = ALL.map((alt) => {
    const kpps = QUANT_LEAVES.filter((l) => l.kpp);
    const cells = kpps.map((l) => s.evidence[cellKey(alt, l.id)]);
    if (cells.some((c) => !c || c.status !== 'verified' || c.value == null)) return { alt, status: 'unknown', failures: [] };
    const failures = kpps.filter((l, i) => !meetsThreshold(cells[i]!.value!, l.threshold!, l.direction!));
    return { alt, status: failures.length ? 'fail' : 'pass', failures };
  });
  const active = s.screeningConfirmed ? screening.filter((x) => x.status === 'pass').map((x) => x.alt) : ALL.filter((a) => screening.find((x) => x.alt === a)?.status !== 'fail');

  const evidenceTotal = QUANT_LEAVES.length * ALL.length;
  const evidenceVerified = QUANT_LEAVES.reduce((n, l) => n + ALL.filter((a) => s.evidence[cellKey(a, l.id)]?.status === 'verified').length, 0);

  const blockers: string[] = [];
  if (s.hierarchy !== 'approved') blockers.push('The criteria hierarchy has not been approved.');
  if (evidenceVerified < evidenceTotal) blockers.push(`${evidenceTotal - evidenceVerified} evidence values still need verifying.`);
  if (!s.screeningConfirmed) blockers.push('Threshold screening has not been confirmed.');
  const ready = blockers.length === 0 && active.length >= 2;

  const qualCR: Record<string, number> = {};
  const leafPriorities: Record<string, number[]> = {};
  for (const c of CRITERIA)
    for (const l of c.leaves) {
      if (l.kind === 'qual') {
        const full = buildMatrix(ALL.length, s.qual[l.id] ?? []);
        qualCR[l.id] = consistency(full).cr;
        const idx = active.map((a) => ALL.indexOf(a));
        const sub = idx.map((i) => idx.map((j) => full[i][j]));
        leafPriorities[l.id] = sub.length ? priorityVector(sub) : [];
      } else {
        const vals = active.map((a) => s.evidence[cellKey(a, l.id)]?.value ?? null);
        leafPriorities[l.id] = vals.some((v) => v == null)
          ? active.map(() => 0)
          : normalize(vals.map((v) => valueScore(v!, l.threshold!, l.objective!)));
      }
    }

  const S = CRITERIA.map((c) =>
    active.map((_, ai) => c.leaves.reduce((sum, l, li) => sum + localWeights[c.id][li] * (leafPriorities[l.id][ai] ?? 0), 0)),
  );
  const global = active.length ? synthesize(g.weights, S) : [];
  const ranking = active.map((alt, i) => ({ alt, score: global[i] })).sort((a, b) => b.score - a.score);

  const divergence: Divergence[] = CRITERIA.map((c, k) => {
    const ws = included.map((x) => ({ expert: x.expert, w: x.weights[k] }));
    const mean = ws.reduce((a, b) => a + b.w, 0) / ws.length;
    const sd = Math.sqrt(ws.reduce((a, b) => a + (b.w - mean) ** 2, 0) / ws.length);
    const sorted = [...ws].sort((a, b) => a.w - b.w);
    return { criterion: c.id, cv: sd / mean, low: sorted[0], high: sorted[sorted.length - 1] };
  }).sort((a, b) => b.cv - a.cv);

  return {
    individuals,
    included,
    groupMatrix,
    W: g.weights,
    groupCR: g.cr,
    localWeights,
    areaCR,
    qualCR,
    screening,
    active,
    evidenceVerified,
    evidenceTotal,
    ready,
    blockers,
    leafPriorities,
    S,
    global,
    ranking,
    divergence,
  };
}
