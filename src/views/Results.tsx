import { useState } from 'react';
import { crossovers, sensitivityLines } from '../ahp/engine';
import { CRITERIA, altById, type CriterionId } from '../data/scenario';
import { SensitivityChart, StackedScore } from '../components/charts';
import { AICard, AIButton, Badge, Button, ErrorNote, Gate, Pager, Provenance, Section, StepHeader, pct, useAI } from '../components/ui';
import { useStore } from '../state/store';
import { reversals } from '../state/sensitivity';
import type { SensitivityNote } from '../state/types';

export function sensitivityFacts(model: ReturnType<typeof useStore>['model']) {
  const names = model.active.map((a) => altById(a).name);
  const idx = (alt: string) => model.active.indexOf(alt as any);
  const [first, second] = model.ranking;
  const revs = reversals(model.W, model.S);
  return {
    leader: altById(first.alt).name,
    runnerUp: altById(second.alt).name,
    margin: first.score - second.score,
    stable: CRITERIA.filter((_, k) => !revs.some((r) => r.k === k)).map((c) => c.short),
    reversals: revs.map((r) => ({ criterion: CRITERIA[r.k].short, current: r.current, at: r.at, newLeader: names[r.newLeader] })),
    _idx: idx,
  };
}

export default function Results() {
  const { state, model, update, log } = useStore();
  const ai = useAI();
  const [crit, setCrit] = useState<CriterionId>('COST');
  const [result, setResult] = useState<any>(null);

  if (!model.ready) {
    return (
      <>
        <StepHeader eyebrow="Step 7 of 8" title="Results and sensitivity" lede="Results appear once the earlier steps are finished." />
        <Gate blockers={model.blockers} />
        <Pager here="results" />
      </>
    );
  }

  const k = CRITERIA.findIndex((c) => c.id === crit);
  const lines = sensitivityLines(model.W, model.S, k);
  const xs = crossovers(model.W, model.S, k);
  const names = model.active.map((a) => altById(a).name);
  const colors = model.active.map((a) => altById(a).color);
  const maxScore = Math.max(...model.global);
  const facts = sensitivityFacts(model);

  async function explain() {
    const { _idx, ...f } = facts;
    const r = await ai.run('sensitivity', f);
    if (!r) return;
    setResult(r);
    update((s) => ({ ...s, sensitivityNote: r.data as SensitivityNote }));
    log('ai', 'results', 'AI summarised the sensitivity analysis.', 'ai');
  }

  return (
    <>
      <StepHeader
        eyebrow="Step 7 of 8"
        title="Results and sensitivity"
        lede="The overall score combines the group’s criteria weights with each proposal’s scores. A ranking is only as good as its margin, so check how much the weights would have to change before first place changes."
        ai={['Finds every weight at which the ranking would change', 'Explains in plain English how robust the result is']}
        human={['The team decides whether the margin is big enough to rely on', 'The SSA weighs anything the model doesn’t capture']}
      />

      <Section title="Overall ranking" subtitle="Bar segments show how much each criterion contributes.">
        <div className="card">
          {model.ranking.map((r, i) => {
            const ai = model.active.indexOf(r.alt);
            return (
              <div className="row" key={r.alt} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
                <div className="hstack" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span className="hstack">
                    <span className="title-3 num" style={{ width: 28 }}>{i + 1}</span>
                    <span className="headline">{altById(r.alt).vendor} {altById(r.alt).name}</span>
                    {i === 0 && <Badge tone="green">Highest score</Badge>}
                  </span>
                  <span className="title-3 num">{r.score.toFixed(3)}</span>
                </div>
                <div style={{ width: '100%' }}>
                  <StackedScore label={altById(r.alt).name} max={maxScore} segments={CRITERIA.map((c, ci) => ({ label: c.short, value: model.W[ci] * model.S[ci][ai], color: c.color }))} />
                </div>
              </div>
            );
          })}
          <div className="legend" style={{ padding: '4px 16px 14px' }}>
            {CRITERIA.map((c) => <span key={c.id}><i className="dot" style={{ background: c.color }} />{c.short}</span>)}
          </div>
        </div>
        <div className="section-foot">
          Screened out: {model.screening.filter((x) => x.status === 'fail').map((x) => `${altById(x.alt).name} (${x.failures.map((f) => f.short).join(', ')})`).join('; ') || 'none'}.
          Margin between first and second: {((model.ranking[0].score - model.ranking[1].score) * 100).toFixed(1)} points.
        </div>
      </Section>

      <Section title="What if the weights were different?" subtitle="Choose a criterion. Its weight runs from 0 to 100% while the others keep their proportions.">
        <div style={{ marginBottom: 10 }}>
          <label className="sr-only" htmlFor="crit">Criterion</label>
          <select id="crit" className="plain" value={crit} onChange={(e) => setCrit(e.target.value as CriterionId)}>
            {CRITERIA.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="card pad">
          <SensitivityChart lines={lines} names={names} colors={colors} current={model.W[k]} crossovers={xs} criterion={CRITERIA[k].short} />
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          {facts.reversals.length === 0 ? (
            <div className="row">No weight change on a single criterion changes who comes first.</div>
          ) : (
            facts.reversals.map((r, i) => (
              <div className="row" key={i}>
                <span className="grow">
                  <strong>{r.criterion}</strong>: <span className="secondary">{r.newLeader} ranks first if the weight {r.at > r.current ? 'rises' : 'falls'} to</span> {pct(r.at)}
                </span>
                <Badge tone={Math.abs(r.at - r.current) < 0.1 ? 'orange' : 'gray'}>now {pct(r.current)}</Badge>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Interpretation">
        {!state.sensitivityNote ? (
          <>
            <AIButton busy={ai.busy} busyLabel="Analysing…" onClick={explain}>Explain how robust this is</AIButton>
            <ErrorNote error={ai.error} />
          </>
        ) : (
          <AICard
            title="Sensitivity summary"
            provenance={<Provenance result={result} step="results" />}
            footer={<Button variant="gray" onClick={() => update((s) => ({ ...s, sensitivityNote: null }))}>Discard</Button>}
          >
            <p style={{ marginTop: 0 }}>{state.sensitivityNote.summary}</p>
            <ul style={{ marginBottom: 0, paddingLeft: 18 }} className="subhead">
              {state.sensitivityNote.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </AICard>
        )}
      </Section>
      <Pager here="results" />
    </>
  );
}
