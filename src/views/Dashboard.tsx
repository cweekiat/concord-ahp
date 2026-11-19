import { CR_LIMIT } from '../ahp/engine';
import { ALTERNATIVES, CRITERIA, QUANT_LEAVES, altById, expertById, leafCriterion } from '../data/scenario';
import { ChartCard, HBarChart, HierarchyDiagram, KPI, RadarChart, StackedHBar, Stepper } from '../components/dashcharts';
import { Avatar, Badge, Button, Icon, StepHeader, pct, useNav } from '../components/ui';
import { useStore } from '../state/store';
import { PROCESS, pendingActions, stepDone } from '../state/progress';
import { reversals } from '../state/sensitivity';
import { cellKey } from '../state/types';
import { DEFAULT_SAVINGS, savingFor } from '../data/savings';

const SHORT: Record<string, string> = { pm: 'Program Mgr', sensor: 'Sensor Eng.', ram: 'RAM Eng.', ils: 'ILS Lead', cost: 'Cost Analyst', te: 'T&E Lead', cyber: 'Cyber Lead', ops: 'Operator Rep', ssa: 'SSA' };

export default function Dashboard() {
  const { state, model } = useStore();
  const { go } = useNav();
  const done = stepDone(state, model);
  const nDone = PROCESS.filter((p) => done[p.id]).length;
  const firstOpen = PROCESS.find((p) => !done[p.id])?.id;
  const actions = pendingActions(state, model);
  const consistent = model.individuals.filter((x) => x.cr <= CR_LIMIT).length;
  const ready = model.ready;
  const lead = ready ? model.ranking[0] : null;
  const margin = ready ? model.ranking[0].score - model.ranking[1].score : 0;
  const revs = ready ? reversals(model.W, model.S) : [];
  const nearest = [...revs].sort((a, b) => Math.abs(a.at - a.current) - Math.abs(b.at - b.current))[0];

  const aiCount = state.audit.filter((e) => e.actor === 'ai').length;
  const accepted = state.audit.filter((e) => e.kind === 'accept').length;
  const rejected = state.audit.filter((e) => e.kind === 'reject').length;
  const corrections = Object.values(state.evidence).filter((c) => c.correctedFrom != null).length;
  const humanCount = state.audit.filter((e) => e.actor !== 'ai' && e.actor !== 'system').length;
  const savedSoFar = PROCESS.filter((p) => done[p.id]).reduce((s, p) => s + savingFor(p.id, DEFAULT_SAVINGS), 0);

  // Evidence status by owner
  const owners = Array.from(new Set(QUANT_LEAVES.map((l) => leafCriterion(l.id).owner)));
  const evRows = owners.map((o) => {
    const cells = QUANT_LEAVES.filter((l) => leafCriterion(l.id).owner === o).flatMap((l) => ALTERNATIVES.map((a) => state.evidence[cellKey(a.id, l.id)]));
    return {
      label: SHORT[o],
      values: [
        cells.filter((c) => c?.status === 'verified').length,
        cells.filter((c) => c?.status === 'ai' && !c.flag).length,
        cells.filter((c) => c?.status === 'ai' && c.flag).length,
        cells.filter((c) => !c).length,
      ],
    };
  });
  const evSeries = [
    { name: 'Verified', color: 'var(--green)' },
    { name: 'AI, unchecked', color: 'var(--indigo)' },
    { name: 'Flagged', color: 'var(--orange)' },
    { name: 'Not extracted', color: 'var(--fill)', pattern: true },
  ];

  const radarSeries = ready
    ? model.active.map((a, ai) => ({
        name: altById(a).name,
        color: altById(a).color,
        values: CRITERIA.map((_, ci) => {
          const best = Math.max(...model.S[ci]);
          return best > 0 ? model.S[ci][ai] / best : 0;
        }),
      }))
    : [];

  const altLegend = (alts: string[]) => alts.map((a) => <span key={a}><i className="dot" style={{ background: altById(a as any).color }} />{altById(a as any).name}</span>);

  return (
    <>
      <StepHeader eyebrow="Management" title="Dashboard" lede={`Project TERN · ${nDone}/8 steps complete`} />

      <div className="kpi-grid">
        <KPI label="Progress" value={`${nDone}/8`} sub={firstOpen ? `Next: ${PROCESS.find((p) => p.id === firstOpen)!.label}` : 'Complete'} />
        <KPI label="Evidence verified" value={pct(model.evidenceVerified / model.evidenceTotal)} sub={`${model.evidenceVerified}/${model.evidenceTotal} values`} />
        <KPI label="Consistent evaluators" value={`${consistent}/${model.individuals.length}`} sub="CR ≤ 0.10" tone={consistent < model.individuals.length ? 'warn' : undefined} />
        <KPI label="Leading proposal" value={lead ? altById(lead.alt).name : '—'} sub={lead ? `+${(margin * 100).toFixed(1)} pts` : 'After scoring'} />
        <KPI label="Decision" value={state.decision ? 'Signed' : 'Open'} sub={state.decision ? altById(state.decision.alt).name : `${actions.length} actions open`} />
        <KPI label="Analyst hours saved" value={`${savedSoFar.toFixed(0)} h`} sub="Completed steps (illustrative)" />
      </div>

      <section className="card chart-card" aria-label="Process">
        <header className="chart-head"><h2 className="headline">Process</h2></header>
        <Stepper steps={PROCESS.map((p) => ({ label: p.label, state: done[p.id] ? 'done' : p.id === firstOpen ? 'current' : 'todo', onClick: () => go(p.id) }))} />
      </section>

      <ChartCard
        title="AHP decision hierarchy"
        value={ready ? 'Link width = contribution' : 'Scores after scoring'}
        table={
          <table className="data">
            <thead><tr><th scope="col">Criterion</th><th scope="col" className="r">Weight</th>{model.active.map((a) => <th scope="col" className="r" key={a}>{altById(a).name}</th>)}</tr></thead>
            <tbody>
              {CRITERIA.map((c, ci) => (
                <tr key={c.id}><th scope="row" style={{ fontWeight: 400 }}>{c.short}</th><td className="r">{pct(model.W[ci], 1)}</td>{model.active.map((a, ai) => <td className="r" key={a}>{ready ? (model.W[ci] * model.S[ci][ai]).toFixed(3) : '—'}</td>)}</tr>
              ))}
              <tr><th scope="row">Overall</th><td />{model.active.map((a, ai) => <td className="r" key={a} style={{ fontWeight: 700 }}>{ready ? model.global[ai].toFixed(3) : '—'}</td>)}</tr>
            </tbody>
          </table>
        }
      >
        <HierarchyDiagram
          goal={state.goal}
          criteria={CRITERIA.map((c, i) => ({ name: c.short, weight: model.W[i], color: c.color }))}
          alternatives={model.active.map((a, i) => ({ name: altById(a).name, score: ready ? model.global[i] : null, leader: ready && model.ranking[0].alt === a }))}
          contribution={ready ? CRITERIA.map((_, ci) => model.active.map((_, ai) => model.W[ci] * model.S[ci][ai])) : null}
        />
      </ChartCard>

      <div className="dash-grid">
        <ChartCard
          title="Proposal comparison"
          value="Score ÷ best per criterion"
          legend={ready ? altLegend(model.active) : undefined}
          table={
            ready && (
              <table className="data">
                <thead><tr><th scope="col">Criterion</th>{radarSeries.map((s) => <th scope="col" className="r" key={s.name}>{s.name}</th>)}</tr></thead>
                <tbody>{CRITERIA.map((c, ci) => <tr key={c.id}><th scope="row" style={{ fontWeight: 400 }}>{c.short}</th>{radarSeries.map((s) => <td className="r" key={s.name}>{s.values[ci].toFixed(2)}</td>)}</tr>)}</tbody>
              </table>
            )
          }
        >
          {ready ? <RadarChart axes={CRITERIA.map((c) => c.short)} series={radarSeries} /> : <Empty go={() => go('evidence')} />}
        </ChartCard>

        <ChartCard title="Overall ranking" value={nearest ? `Flips if ${CRITERIA[nearest.k].short} → ${pct(nearest.at)}` : undefined}>
          {ready ? (
            <HBarChart labelWidth={110} rows={model.ranking.map((r) => ({ label: altById(r.alt).name, value: r.score, color: altById(r.alt).color }))} format={(v) => v.toFixed(3)} />
          ) : (
            <Empty go={() => go('evidence')} />
          )}
        </ChartCard>

        <ChartCard title="Group criteria weights" value={`CR ${model.groupCR.toFixed(3)}`}>
          <HBarChart labelWidth={120} rows={CRITERIA.map((c, i) => ({ label: c.short, value: model.W[i], color: c.color })).sort((a, b) => b.value - a.value)} format={(v) => pct(v, 1)} />
        </ChartCard>

        <ChartCard title="Evaluator consistency" value={`${consistent}/${model.individuals.length} within limit`}>
          <HBarChart
            labelWidth={110}
            rows={model.individuals.map((x) => ({ label: SHORT[x.expert.id], value: x.cr, color: x.cr > CR_LIMIT ? 'var(--orange)' : 'var(--green)', note: x.cr > CR_LIMIT ? 'over limit' : 'OK' }))}
            format={(v) => (v > CR_LIMIT ? `${v.toFixed(2)} ⚠︎` : v.toFixed(2))}
            max={Math.max(0.2, ...model.individuals.map((x) => x.cr * 1.1))}
            threshold={{ value: CR_LIMIT, label: 'Limit 0.10' }}
          />
        </ChartCard>

        <ChartCard title="Evidence status by owner" legend={evSeries.map((s) => <span key={s.name}><i className="dot" style={{ background: s.pattern ? 'var(--fill)' : s.color }} />{s.name}</span>)}>
          <StackedHBar labelWidth={110} rows={evRows} series={evSeries} />
        </ChartCard>

        <ChartCard title="Disagreement by criterion" value="Spread across evaluators">
          <HBarChart labelWidth={120} rows={model.divergence.map((d) => ({ label: CRITERIA.find((c) => c.id === d.criterion)!.short, value: d.cv, color: 'var(--indigo)', note: `${d.low.expert.role} ${pct(d.low.w)} ↔ ${d.high.expert.role} ${pct(d.high.w)}` }))} format={(v) => pct(v)} />
        </ChartCard>
      </div>

      <div className="dash-grid">
        <section className="card chart-card" aria-label="Open actions">
          <header className="chart-head"><h2 className="headline">Open actions</h2><span className="subhead secondary num">{actions.length}</span></header>
          {actions.length === 0 ? (
            <div className="row secondary">Nothing outstanding.</div>
          ) : (
            actions.map((a, i) => (
              <div className="row" key={i}>
                <Avatar initials={expertById(a.who).initials} />
                <span className="grow">{a.what}<div className="footnote secondary">{expertById(a.who).role}</div></span>
                <Button small variant="plain" onClick={() => go(a.step)} aria-label={`Open ${a.step}`}><Icon name="chevronRight" /></Button>
              </div>
            ))
          )}
        </section>

        <section className="card chart-card" aria-label="AI oversight">
          <header className="chart-head"><h2 className="headline">AI oversight</h2></header>
          <div className="kpi-grid compact">
            <KPI label="AI suggestions" value={aiCount} />
            <KPI label="Accepted" value={accepted} />
            <KPI label="Rejected / kept" value={rejected} />
            <KPI label="Evidence corrected" value={corrections} />
          </div>
          <HBarChart labelWidth={110} rows={[{ label: 'People', value: humanCount, color: 'var(--green)' }, { label: 'AI', value: aiCount, color: 'var(--indigo)' }]} format={(v) => `${v} actions`} />
          <div className="row" style={{ paddingTop: 0 }}>
            <Badge tone="green">AI cast 0 judgments</Badge>
            <Badge tone="green">Decision by SSA only</Badge>
          </div>
        </section>
      </div>
    </>
  );
}

function Empty({ go }: { go: () => void }) {
  return (
    <div className="row" style={{ minHeight: 160, justifyContent: 'center', flexDirection: 'column' }}>
      <span className="secondary">Available once evidence is verified and screening confirmed.</span>
      <Button small onClick={go}>Go to Evidence</Button>
    </div>
  );
}
