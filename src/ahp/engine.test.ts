import { describe, expect, it } from 'vitest';
import {
  buildMatrix,
  consistency,
  crossovers,
  geometricMeanMatrix,
  judgmentToPosition,
  judgmentsFromWeights,
  mostInconsistentJudgment,
  positionToJudgment,
  scoreAt,
  sensitivityLines,
  snapToSaaty,
  synthesize,
  valueScore,
  SAATY_VALUES,
} from './engine';

describe('priorities and consistency', () => {
  it('matches the classic 3×3 textbook example', () => {
    const m = buildMatrix(3, [3, 5, 3]);
    const c = consistency(m);
    expect(c.weights[0]).toBeCloseTo(0.637, 3);
    expect(c.weights[1]).toBeCloseTo(0.258, 3);
    expect(c.weights[2]).toBeCloseTo(0.105, 3);
    expect(c.lambdaMax).toBeCloseTo(3.039, 3);
    expect(c.cr).toBeCloseTo(0.033, 2);
  });

  it('gives CR = 0 for a perfectly consistent matrix', () => {
    const w = [0.5, 0.25, 0.125, 0.125];
    const m = buildMatrix(4, [2, 4, 4, 2, 2, 1]);
    const c = consistency(m);
    c.weights.forEach((x, i) => expect(x).toBeCloseTo(w[i], 6));
    expect(c.cr).toBeCloseTo(0, 6);
  });

  it('snaps to the Saaty scale in log space', () => {
    expect(snapToSaaty(2.4)).toBe(2);
    expect(snapToSaaty(2.5)).toBe(3);
    expect(snapToSaaty(0.3)).toBeCloseTo(1 / 3);
    expect(snapToSaaty(40)).toBe(9);
  });
});

describe('group aggregation (AIJ)', () => {
  it('keeps the reciprocal property', () => {
    const a = buildMatrix(3, [3, 5, 2]);
    const b = buildMatrix(3, [1 / 3, 2, 4]);
    const g = geometricMeanMatrix([a, b]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(g[i][j] * g[j][i]).toBeCloseTo(1, 9);
    expect(g[0][1]).toBeCloseTo(1, 9);
  });
});

describe('consistency coach maths', () => {
  it('finds and fixes a planted reversed judgment', () => {
    const w = [0.3, 0.2, 0.12, 0.1, 0.1, 0.1, 0.08];
    const upper = judgmentsFromWeights(w);
    // Reverse criterion 0 vs 3 (should be 3, set to 1/5).
    const pairs = upper.length;
    expect(pairs).toBe(21);
    upper[2] = 1 / 5;
    const m = buildMatrix(7, upper);
    expect(consistency(m).cr).toBeGreaterThan(0.1);
    const fix = mostInconsistentJudgment(m)!;
    expect([fix.i, fix.j]).toEqual([0, 3]);
    expect(fix.crAfter).toBeLessThanOrEqual(0.1);
    expect(fix.suggested).toBeGreaterThan(1);
  });
});

describe('synthesis and sensitivity', () => {
  const W = [0.5, 0.3, 0.2];
  const S = [
    [0.6, 0.3, 0.1],
    [0.2, 0.5, 0.3],
    [0.1, 0.2, 0.7],
  ];

  it('weighted-sum synthesis', () => {
    const g = synthesize(W, S);
    expect(g[0]).toBeCloseTo(0.38);
    expect(g[1]).toBeCloseTo(0.34);
    expect(g[2]).toBeCloseTo(0.28);
  });

  it('sensitivity lines pass through the current scores', () => {
    const g = synthesize(W, S);
    for (let k = 0; k < 3; k++) {
      sensitivityLines(W, S, k).forEach((line, a) => expect(scoreAt(line, W[k])).toBeCloseTo(g[a], 9));
    }
  });

  it('crossovers are real ties', () => {
    const lines = sensitivityLines(W, S, 2);
    for (const x of crossovers(W, S, 2)) expect(scoreAt(lines[x.a], x.t)).toBeCloseTo(scoreAt(lines[x.b], x.t), 9);
  });
});

describe('value function and slider mapping', () => {
  it('maps threshold → floor and objective → 1, both directions', () => {
    expect(valueScore(20, 20, 35)).toBeCloseTo(0.1);
    expect(valueScore(35, 20, 35)).toBeCloseTo(1);
    expect(valueScore(50, 20, 35)).toBeCloseTo(1);
    expect(valueScore(25, 25, 10)).toBeCloseTo(0.1);
    expect(valueScore(10, 25, 10)).toBeCloseTo(1);
  });

  it('round-trips every Saaty value through the slider', () => {
    for (const v of SAATY_VALUES) expect(positionToJudgment(judgmentToPosition(v))).toBeCloseTo(v, 9);
  });
});
