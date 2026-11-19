import { crossovers, scoreAt, sensitivityLines } from '../ahp/engine';

export interface Reversal {
  k: number;
  current: number;
  at: number;
  newLeader: number;
  direction: 'up' | 'down';
}

/** For each criterion, the nearest weight (above and below the current one) at which first place changes. */
export function reversals(W: number[], S: number[][]): Reversal[] {
  const out: Reversal[] = [];
  W.forEach((wk, k) => {
    const lines = sensitivityLines(W, S, k);
    const leaderAt = (t: number) => lines.reduce((best, l, i) => (scoreAt(l, t) > scoreAt(lines[best], t) ? i : best), 0);
    const cur = leaderAt(wk);
    const xs = crossovers(W, S, k);
    const up = xs.filter((x) => x.t > wk).find((x) => leaderAt(x.t + 1e-6) !== cur);
    if (up) out.push({ k, current: wk, at: up.t, newLeader: leaderAt(up.t + 1e-6), direction: 'up' });
    const down = xs
      .filter((x) => x.t < wk)
      .reverse()
      .find((x) => leaderAt(x.t - 1e-6) !== cur);
    if (down) out.push({ k, current: wk, at: down.t, newLeader: leaderAt(down.t - 1e-6), direction: 'down' });
  });
  return out;
}
