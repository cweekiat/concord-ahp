import { useState } from 'react';
import { DEFAULT_SAVINGS, totals, type SavingsInputs } from '../data/savings';
import { Badge, Button, Callout, Pager, Section, StepHeader } from '../components/ui';

const FIELDS: Array<{ key: keyof SavingsInputs; label: string; min: number; max: number; step?: number }> = [
  { key: 'vendors', label: 'Proposals', min: 2, max: 12 },
  { key: 'paramsPerVendor', label: 'Values per proposal', min: 5, max: 200 },
  { key: 'experts', label: 'Evaluators', min: 2, max: 30 },
  { key: 'criteria', label: 'Top-level criteria', min: 3, max: 10 },
  { key: 'inconsistentExperts', label: 'Evaluators needing a consistency fix', min: 0, max: 30 },
  { key: 'hourlyRate', label: 'Loaded labour rate ($/h)', min: 50, max: 400, step: 10 },
  { key: 'schedulingLagDays', label: 'Days to schedule a meeting', min: 0, max: 15 },
];

export default function Savings() {
  const [x, setX] = useState<SavingsInputs>(DEFAULT_SAVINGS);
  const t = totals(x);
  const maxH = Math.max(...t.rows.map((r) => r.manualHours));
  const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

  return (
    <>
      <StepHeader
        eyebrow="Reference"
        title="Resources saved"
        lede="Illustrative model. Edit the assumptions below."
      />

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="card stat">
          <div className="label">Person-hours</div>
          <div className="value">{t.manualHours.toFixed(0)} → {t.aiHours.toFixed(0)}</div>
          <div className="footnote secondary">{t.savedHours.toFixed(0)} h saved ({(t.savedPct * 100).toFixed(0)}%)</div>
        </div>
        <div className="card stat">
          <div className="label">Labour cost</div>
          <div className="value">{money(t.manualCost - t.aiCost)}</div>
          <div className="footnote secondary">{money(t.manualCost)} → {money(t.aiCost)}</div>
        </div>
        <div className="card stat">
          <div className="label">Elapsed working days</div>
          <div className="value">{t.manualDays.toFixed(0)} → {t.aiDays.toFixed(0)}</div>
          <div className="footnote secondary">{t.manualMeetings} → {t.aiMeetings} meetings</div>
        </div>
      </div>

      <Section title="By task" subtitle="Grey: manual · Indigo: AI-assisted">
        <div className="card">
          {t.rows.map((r) => (
            <div className="row" key={r.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <span className="headline" style={{ fontSize: '0.9375rem' }}>{r.task}</span>
                {r.unchanged ? <Badge tone="green">Unchanged — expert work</Badge> : <span className="subhead num secondary">{r.manualHours.toFixed(1)} h → {r.aiHours.toFixed(1)} h</span>}
              </div>
              <div aria-hidden className="stack" style={{ gap: 4 }}>
                <span className="bar-track"><span className="bar-fill" style={{ display: 'block', width: `${(r.manualHours / maxH) * 100}%`, background: 'var(--gray)' }} /></span>
                <span className="bar-track"><span className="bar-fill" style={{ display: 'block', width: `${(r.aiHours / maxH) * 100}%`, background: 'var(--indigo)' }} /></span>
              </div>
              <p className="footnote secondary" style={{ margin: 0 }}>{r.basis}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Assumptions" action={<Button small variant="plain" onClick={() => setX(DEFAULT_SAVINGS)}>Reset</Button>}>
        <div className="card">
          {FIELDS.map((f) => (
            <div className="row" key={f.key}>
              <label className="grow" htmlFor={`f-${f.key}`}>{f.label}</label>
              <input
                id={`f-${f.key}`}
                className="input num"
                style={{ width: 110, textAlign: 'right' }}
                type="number"
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                value={x[f.key]}
                onChange={(e) => {
                  const v = Math.min(f.max, Math.max(f.min, Number(e.target.value) || f.min));
                  setX((p) => ({ ...p, [f.key]: v }));
                }}
              />
            </div>
          ))}
        </div>
        <div className="section-foot">Elapsed days = analyst hours ÷ 6 productive hours per day + scheduling lag for each meeting + 2 days for review. The consensus meeting and expert judgment time are left out of analyst hours.</div>
      </Section>
      <Pager here="savings" />
    </>
  );
}
