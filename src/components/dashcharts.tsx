/**
 * Dashboard charts. Hand-built SVG so they follow the app's HIG tokens in light and dark.
 * Specs: bars ≤ 24 px with 4 px rounded data-end, 2 px lines, ≥ 8 px markers with a surface
 * ring, hairline grid, text in text tokens (never the series colour), native tooltips on marks,
 * and a data-table disclosure under every chart.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Measure the container so SVG text renders at true size instead of scaling down on phones. */
function useWidth(fallback = 520) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function ChartCard({ title, value, children, table, legend }: { title: string; value?: ReactNode; children: ReactNode; table?: ReactNode; legend?: ReactNode }) {
  return (
    <section className="card chart-card" aria-label={title}>
      <header className="chart-head">
        <h2 className="headline">{title}</h2>
        {value && <span className="subhead secondary num">{value}</span>}
      </header>
      {legend && <div className="legend" style={{ padding: '0 16px 6px' }}>{legend}</div>}
      <div className="chart-body">{children}</div>
      {table && (
        <details className="chart-table">
          <summary>Data table</summary>
          <div className="table-wrap">{table}</div>
        </details>
      )}
    </section>
  );
}

export function KPI({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'warn' }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value num" style={{ color: tone === 'warn' ? 'var(--orange-text)' : undefined }}>{value}</div>
      {sub && <div className="footnote secondary">{sub}</div>}
    </div>
  );
}

/** Rounded-end horizontal bar path anchored at x0 (square at the baseline). */
function hbar(x0: number, y: number, w: number, h: number, r = 4) {
  if (w <= 0) return '';
  const rr = Math.min(r, w, h / 2);
  return `M${x0},${y} H${x0 + w - rr} Q${x0 + w},${y} ${x0 + w},${y + rr} V${y + h - rr} Q${x0 + w},${y + h} ${x0 + w - rr},${y + h} H${x0} Z`;
}

export function HBarChart({
  rows,
  max,
  format,
  threshold,
  labelWidth = 150,
}: {
  rows: Array<{ label: string; value: number; color: string; note?: string }>;
  max?: number;
  format: (v: number) => string;
  threshold?: { value: number; label: string };
  labelWidth?: number;
}) {
  const [ref, W] = useWidth();
  labelWidth = Math.min(labelWidth, Math.round(W * 0.42));
  const bar = 18;
  const gap = 14;
  const H = rows.length * (bar + gap) + (threshold ? 18 : 4);
  const plotW = W - labelWidth - 64;
  const m = max ?? Math.max(...rows.map((r) => r.value), threshold?.value ?? 0) * 1.05;
  const x = (v: number) => labelWidth + (v / m) * plotW;
  return (
    <div ref={ref}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rows.map((r) => `${r.label} ${format(r.value)}`).join(', ')}>
      <line x1={labelWidth} x2={labelWidth} y1={0} y2={H - (threshold ? 18 : 0)} stroke="var(--separator)" />
      {rows.map((r, i) => {
        const y = i * (bar + gap) + 4;
        return (
          <g key={r.label} className="mark">
            <title>{`${r.label}: ${format(r.value)}${r.note ? ` · ${r.note}` : ''}`}</title>
            <rect x={0} y={y - 6} width={W} height={bar + 12} fill="transparent" />
            <text x={labelWidth - 10} y={y + bar / 2 + 4} textAnchor="end" fontSize="13" fill="var(--label)">{r.label}</text>
            <path d={hbar(labelWidth, y, x(r.value) - labelWidth, bar)} fill={r.color} />
            <text x={x(r.value) + 6} y={y + bar / 2 + 4} fontSize="12" fill="var(--label-2)">{format(r.value)}</text>
          </g>
        );
      })}
      {threshold && (
        <g>
          <line x1={x(threshold.value)} x2={x(threshold.value)} y1={0} y2={H - 16} stroke="var(--label-2)" strokeDasharray="3 3" />
          <text x={x(threshold.value)} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--label-2)">{threshold.label}</text>
        </g>
      )}
    </svg>
    </div>
  );
}

export function StackedHBar({
  rows,
  series,
  labelWidth = 150,
}: {
  rows: Array<{ label: string; values: number[] }>;
  series: Array<{ name: string; color: string; pattern?: boolean }>;
  labelWidth?: number;
}) {
  const [ref, W] = useWidth();
  labelWidth = Math.min(labelWidth, Math.round(W * 0.42));
  const bar = 18;
  const gap = 14;
  const H = rows.length * (bar + gap);
  const plotW = W - labelWidth - 40;
  const max = Math.max(...rows.map((r) => r.values.reduce((a, b) => a + b, 0)), 1);
  return (
    <div ref={ref}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rows.map((r) => `${r.label}: ${r.values.map((v, i) => `${series[i].name} ${v}`).join(', ')}`).join('; ')}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--fill-2)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--label-3)" strokeWidth="2" />
        </pattern>
      </defs>
      {rows.map((r, i) => {
        const y = i * (bar + gap) + 4;
        let x0 = labelWidth;
        const total = r.values.reduce((a, b) => a + b, 0);
        return (
          <g key={r.label}>
            <text x={labelWidth - 10} y={y + bar / 2 + 4} textAnchor="end" fontSize="13" fill="var(--label)">{r.label}</text>
            {r.values.map((v, si) => {
              if (v <= 0) return null;
              const w = (v / max) * plotW;
              const last = r.values.slice(si + 1).every((x) => x <= 0);
              const seg = (
                <g key={si} className="mark">
                  <title>{`${r.label} · ${series[si].name}: ${v}`}</title>
                  {last ? <path d={hbar(x0, y, w - 2, bar)} fill={series[si].pattern ? 'url(#hatch)' : series[si].color} /> : <rect x={x0} y={y} width={Math.max(0, w - 2)} height={bar} fill={series[si].pattern ? 'url(#hatch)' : series[si].color} />}
                </g>
              );
              x0 += w;
              return seg;
            })}
            <text x={labelWidth + (total / max) * plotW + 6} y={y + bar / 2 + 4} fontSize="12" fill="var(--label-2)">{total}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export function RadarChart({
  axes,
  series,
}: {
  axes: string[];
  series: Array<{ name: string; color: string; values: number[] }>;
}) {
  const S = 420;
  const cx = S / 2;
  const cy = S / 2 + 6;
  const R = 140;
  const n = axes.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${S} ${S + 8}`} width="100%" style={{ maxWidth: 460, display: 'block', margin: '0 auto' }} role="img" aria-label={`Radar chart. ${series.map((s) => `${s.name}: ${axes.map((a, i) => `${a} ${s.values[i].toFixed(2)}`).join(', ')}`).join('. ')}`}>
      {rings.map((r) => (
        <polygon key={r} points={axes.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="var(--separator)" strokeWidth={1} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.16);
        const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
        return (
          <g key={a}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--separator)" strokeWidth={1} />
            <text x={lx} y={ly + 4} textAnchor={anchor} fontSize="12.5" fill="var(--label)">{a}</text>
          </g>
        );
      })}
      {rings.map((r) => (
        <text key={`t${r}`} x={cx + 4} y={cy - R * r + 11} fontSize="10" fill="var(--label-2)">{r.toFixed(2)}</text>
      ))}
      {series.map((s) => (
        <g key={s.name}>
          <polygon points={s.values.map((v, i) => pt(i, v).join(',')).join(' ')} fill={s.color} fillOpacity={0.1} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
          {s.values.map((v, i) => {
            const [x, y] = pt(i, v);
            return (
              <g key={i} className="mark">
                <title>{`${s.name} · ${axes[i]}: ${v.toFixed(2)} of best`}</title>
                <circle cx={x} cy={y} r={9} fill="transparent" />
                <circle cx={x} cy={y} r={4.5} fill={s.color} stroke="var(--bg-elevated)" strokeWidth={2} />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

export function HierarchyDiagram({
  goal,
  criteria,
  alternatives,
  contribution,
}: {
  goal: string;
  criteria: Array<{ name: string; weight: number; color: string }>;
  alternatives: Array<{ name: string; score: number | null; leader: boolean }>;
  /** contribution[c][a] = W[c] · S[c][a]; drives link thickness. */
  contribution: number[][] | null;
}) {
  const W = 1000;
  const H = 430;
  const pad = 16;
  const cw = (W - 2 * pad - (criteria.length - 1) * 12) / criteria.length;
  const cY = 150;
  const cH = 56;
  const aw = 180;
  const aY = 330;
  const aH = 50;
  const aGap = (W - alternatives.length * aw) / (alternatives.length + 1);
  const cx = (i: number) => pad + i * (cw + 12) + cw / 2;
  const ax = (i: number) => aGap + i * (aw + aGap) + aw / 2;
  const maxC = contribution ? Math.max(...contribution.flat()) : 1;
  return (
    <div className="table-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720 }} role="img" aria-label={`AHP hierarchy. Goal: ${goal}. Criteria: ${criteria.map((c) => `${c.name} ${(c.weight * 100).toFixed(1)}%`).join(', ')}. Proposals: ${alternatives.map((a) => `${a.name}${a.score != null ? ` ${a.score.toFixed(3)}` : ''}`).join(', ')}.`}>
        {/* goal → criteria */}
        {criteria.map((c, i) => (
          <line key={`g${i}`} x1={W / 2} y1={20 + 64} x2={cx(i)} y2={cY} stroke="var(--label-3)" strokeWidth={1.5} />
        ))}
        {/* criteria → alternatives, thickness = contribution */}
        {criteria.map((c, i) =>
          alternatives.map((a, j) => {
            const v = contribution ? contribution[i][j] : 0;
            return (
              <line key={`l${i}-${j}`} x1={cx(i)} y1={cY + cH + 28} x2={ax(j)} y2={aY} stroke={contribution ? c.color : 'var(--separator)'} strokeOpacity={contribution ? 0.55 : 1} strokeWidth={contribution ? 0.75 + (v / maxC) * 5 : 1}>
                <title>{contribution ? `${c.name} → ${a.name}: contributes ${v.toFixed(3)}` : ''}</title>
              </line>
            );
          }),
        )}
        {/* goal */}
        <rect x={W / 2 - 230} y={20} width={460} height={64} rx={12} fill="var(--tint-fill)" />
        <text x={W / 2} y={47} textAnchor="middle" fontSize="16" fontWeight={700} fill="#fff">Select EO/IR sensor turret</text>
        <text x={W / 2} y={68} textAnchor="middle" fontSize="12.5" fill="#fff" opacity={0.92}>Project TERN · maritime patrol UAS</text>
        {/* criteria */}
        {criteria.map((c, i) => (
          <g key={c.name} className="mark">
            <title>{`${c.name}: ${(c.weight * 100).toFixed(1)}%`}</title>
            <rect x={cx(i) - cw / 2} y={cY} width={cw} height={cH} rx={10} fill="var(--bg-elevated)" stroke={c.color} strokeWidth={2} />
            <rect x={cx(i) - cw / 2} y={cY} width={cw} height={6} rx={3} fill={c.color} />
            <text x={cx(i)} y={cY + 35} textAnchor="middle" fontSize="13" fontWeight={600} fill="var(--label)">{c.name}</text>
            <text x={cx(i)} y={cY + cH + 20} textAnchor="middle" fontSize="13" fill="var(--label-2)" className="num">{(c.weight * 100).toFixed(1)}%</text>
          </g>
        ))}
        {/* alternatives */}
        {alternatives.map((a, j) => (
          <g key={a.name}>
            <rect x={ax(j) - aw / 2} y={aY} width={aw} height={aH} rx={10} fill="var(--bg-tertiary)" stroke={a.leader ? 'var(--tint)' : 'var(--separator-opaque)'} strokeWidth={a.leader ? 2.5 : 1} />
            <text x={ax(j)} y={aY + 31} textAnchor="middle" fontSize="14" fontWeight={600} fill="var(--label)">{a.name}</text>
            <text x={ax(j)} y={aY + aH + 22} textAnchor="middle" fontSize="13.5" fontWeight={a.leader ? 700 : 400} fill="var(--label)">{a.score != null ? a.score.toFixed(3) : '—'}{a.leader ? '  ★ top' : ''}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Stepper({ steps }: { steps: Array<{ label: string; state: 'done' | 'current' | 'todo'; onClick: () => void }> }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => (
        <li key={s.label} className={s.state}>
          <button onClick={s.onClick} aria-label={`${i + 1}. ${s.label}, ${s.state === 'done' ? 'complete' : s.state === 'current' ? 'in progress' : 'not started'}`}>
            <span className="dot-n" aria-hidden>{s.state === 'done' ? '✓' : i + 1}</span>
            <span className="lbl">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
