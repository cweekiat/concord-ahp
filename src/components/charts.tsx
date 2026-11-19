import { INTENSITY_LABELS, formatJudgment, judgmentToPosition, positionToJudgment, scoreAt } from '../ahp/engine';

export function PairwiseRow({ id, left, right, value, onChange, onCommit, disabled, flagged }: { id: string; left: string; right: string; value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; disabled?: boolean; flagged?: boolean }) {
  const pos = judgmentToPosition(value);
  const strength = value >= 1 ? Math.round(value) : Math.round(1 / value);
  const winner = value >= 1 ? left : right;
  const verdict = strength === 1 ? `${left} and ${right} are equally important` : `${winner} is ${INTENSITY_LABELS[strength]}`;
  return (
    <div className={`pair${flagged ? ' flagged' : ''}`}>
      <div className="pair-labels">
        <span className="l" id={`${id}-l`}>{left}</span>
        <span className="v mono">{formatJudgment(value)}</span>
        <span className="r" id={`${id}-r`}>{right}</span>
      </div>
      <input
        type="range"
        min={-8}
        max={8}
        step={1}
        value={pos}
        disabled={disabled}
        aria-label={`${left} compared with ${right}`}
        aria-valuetext={verdict}
        onChange={(e) => onChange(positionToJudgment(Number(e.target.value)))}
        onPointerUp={(e) => onCommit?.(positionToJudgment(Number((e.target as HTMLInputElement).value)))}
        onKeyUp={(e) => e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' ? onCommit?.(positionToJudgment(Number((e.target as HTMLInputElement).value))) : undefined}
      />
      <div className="ticks" aria-hidden>
        <span>9</span><span>7</span><span>5</span><span>3</span><span>1</span><span>3</span><span>5</span><span>7</span><span>9</span>
      </div>
      <p className="verdict">{verdict}</p>
    </div>
  );
}

export function WeightBars({ items, max }: { items: Array<{ label: string; value: number; color: string; note?: string }>; max?: number }) {
  const m = max ?? Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <div role="list">
      {items.map((it) => (
        <div className="bar-row" role="listitem" key={it.label}>
          <span className="subhead" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.label}
            {it.note && <span className="caption secondary"> · {it.note}</span>}
          </span>
          <span className="bar-track" aria-hidden>
            <span className="bar-fill" style={{ width: `${(it.value / m) * 100}%`, background: it.color, display: 'block' }} />
          </span>
          <span className="subhead num" style={{ textAlign: 'right' }}>{(it.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function StackedScore({ segments, max, label }: { segments: Array<{ label: string; value: number; color: string }>; max: number; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="stack-bar" role="img" aria-label={`${label}: ${total.toFixed(3)} overall. ${segments.map((s) => `${s.label} ${s.value.toFixed(3)}`).join(', ')}`} style={{ width: `${(total / max) * 100}%` }}>
      {segments.map((s) => (
        <span key={s.label} title={`${s.label}: ${s.value.toFixed(3)}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

export function SensitivityChart({
  lines,
  names,
  colors,
  current,
  crossovers,
  criterion,
}: {
  lines: Array<{ at0: number; at1: number }>;
  names: string[];
  colors: string[];
  current: number;
  crossovers: Array<{ t: number; a: number; b: number }>;
  criterion: string;
}) {
  const W = 640, H = 280, L = 44, R = 92, T = 16, B = 40;
  const ys = lines.flatMap((l) => [l.at0, l.at1]);
  const yMax = Math.max(...ys) * 1.08;
  const yMin = 0;
  const x = (t: number) => L + t * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const yTicks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4];
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Overall score of each proposal as the weight of ${criterion} goes from 0 to 100 percent. Current weight ${(current * 100).toFixed(0)} percent.`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--separator)" strokeWidth={0.75} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--label-2)">{v.toFixed(2)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={x(t)} y={H - B + 18} textAnchor="middle" fontSize="11" fill="var(--label-2)">{(t * 100).toFixed(0)}%</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="var(--label-2)">Weight of {criterion}</text>
        <line x1={x(current)} x2={x(current)} y1={T} y2={H - B} stroke="var(--label-3)" strokeDasharray="4 4" />
        <text x={x(current) + 6} y={T + 10} fontSize="11" fill="var(--label-2)">now {(current * 100).toFixed(0)}%</text>
        {lines.map((l, i) => (
          <line key={i} x1={x(0)} y1={y(l.at0)} x2={x(1)} y2={y(l.at1)} stroke={colors[i]} strokeWidth={2.5} strokeLinecap="round" />
        ))}
        {crossovers.map((c, i) => (
          <circle key={i} cx={x(c.t)} cy={y(scoreAt(lines[c.a], c.t))} r={4.5} fill="var(--bg-elevated)" stroke="var(--label)" strokeWidth={1.5} />
        ))}
        {(() => {
          // Direct labels at the right end, nudged apart so they never overlap (no reliance on colour alone).
          const ends = lines.map((l, i) => ({ i, y: y(l.at1) })).sort((a, b) => a.y - b.y);
          for (let n = 1; n < ends.length; n++) if (ends[n].y - ends[n - 1].y < 14) ends[n].y = ends[n - 1].y + 14;
          return ends.map((e) => (
            <text key={`t${e.i}`} x={x(1) + 8} y={e.y + 4} fontSize="12" fontWeight={600} fill="var(--label)">{names[e.i]}</text>
          ));
        })()}
        {lines.map((l, i) => (
          <circle key={`c${i}`} cx={x(current)} cy={y(scoreAt(l, current))} r={4} fill={colors[i]} />
        ))}
      </svg>
      <figcaption className="legend" style={{ padding: '4px 4px 0' }}>
        {names.map((n, i) => (
          <span key={n}><i className="dot" style={{ background: colors[i] }} />{n}</span>
        ))}
        <span><i className="dot" style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--label)' }} />Rank changes</span>
      </figcaption>
    </figure>
  );
}
