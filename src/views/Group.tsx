import { useState } from 'react';
import { CR_LIMIT } from '../ahp/engine';
import { CRITERIA, expertById } from '../data/scenario';
import { WeightBars } from '../components/charts';
import { AICard, AIButton, Avatar, Badge, Button, ErrorNote, Pager, Provenance, Section, StepHeader, Toggle, pct, useAI, useNav } from '../components/ui';
import { useStore } from '../state/store';
import type { DiscussionPrompt } from '../state/types';
import { CRBadge } from './Judgments';

export default function Group() {
  const { state, model, update, log } = useStore();
  const { go } = useNav();
  const ai = useAI();
  const [result, setResult] = useState<any>(null);
  const crit = (id: string) => CRITERIA.find((c) => c.id === id)!;
  const maxW = Math.max(...model.individuals.flatMap((x) => x.weights));
  const inconsistent = model.individuals.filter((x) => x.cr > CR_LIMIT);

  async function draftPrompts() {
    const facts = {
      items: model.divergence.slice(0, 4).map((d) => ({
        criterion: d.criterion,
        name: crit(d.criterion).name,
        cv: d.cv,
        low: { id: d.low.expert.id, role: d.low.expert.role, w: d.low.w },
        high: { id: d.high.expert.id, role: d.high.expert.role, w: d.high.w },
        groupWeight: model.W[CRITERIA.findIndex((c) => c.id === d.criterion)],
      })),
    };
    const r = await ai.run('discussion', facts);
    if (!r) return;
    setResult(r);
    update((s) => ({ ...s, discussion: { ...s.discussion, prompts: r.data as DiscussionPrompt[] } }));
    log('ai', 'group', `AI drafted ${(r.data as DiscussionPrompt[]).length} discussion prompts for the largest disagreements.`, 'ai');
  }

  return (
    <>
      <StepHeader
        eyebrow="Step 5 of 8"
        title="See where the team agrees"
        lede="Individual judgments are combined with a geometric mean (AIJ), the standard way to aggregate a group in AHP. Disagreement is useful information: it shows where evaluators are picturing different missions."
        ai={['Measures how far apart evaluators are on each criterion', 'Drafts neutral questions that bring out the assumptions behind each view', 'Never averages people out of the discussion']}
        human={['The team discusses the real disagreements', 'Evaluators revise their own judgments if they’re persuaded', 'The chair decides whether inconsistent matrices count']}
      />

      <Section title="Group criteria weights" action={<CRBadge cr={model.groupCR} />} subtitle={`From ${model.included.length} of ${model.individuals.length} evaluators.`}>
        <div className="card" style={{ padding: '8px 0' }}>
          <WeightBars items={CRITERIA.map((c, i) => ({ label: c.short, value: model.W[i], color: c.color }))} />
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="grow">
              <div>Leave out evaluators whose CR is over 0.10</div>
              <div className="footnote secondary">
                {inconsistent.length ? `Right now that’s ${inconsistent.map((x) => x.expert.name).join(', ')}. ` : 'Every evaluator is within the limit right now. '}
                Ask them to revise first. Leaving someone out is a judgment call for the chair.
              </div>
            </div>
            <Toggle
              checked={state.excludeInconsistent}
              label="Leave out inconsistent evaluators"
              onChange={(v) => {
                update((s) => ({ ...s, excludeInconsistent: v }));
                log('edit', 'group', v ? 'Excluded evaluators with CR > 0.10 from aggregation.' : 'Included all evaluators in aggregation.');
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Who weighs what" subtitle="Each evaluator’s weights. Darker cells mean more weight.">
        <div className="card table-wrap">
          <table className="data heat">
            <thead>
              <tr>
                <th scope="col">Evaluator</th>
                {CRITERIA.map((c) => <th scope="col" key={c.id} className="r" style={{ textAlign: 'center' }}>{c.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {model.individuals.map((x) => (
                <tr key={x.expert.id} style={{ opacity: model.included.includes(x) ? 1 : 0.45 }}>
                  <th scope="row" style={{ fontWeight: 400, whiteSpace: 'nowrap' }}>
                    {x.expert.role}
                    {x.cr > CR_LIMIT && <> <Badge tone="orange">CR {x.cr.toFixed(2)}</Badge></>}
                  </th>
                  {x.weights.map((w, i) => (
                    <td key={i} className="h num" style={{ background: `color-mix(in srgb, var(--blue) ${Math.round((w / maxW) * 45)}%, transparent)` }}>
                      {pct(w)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Group</th>
                {model.W.map((w, i) => <td key={i} className="h num" style={{ fontWeight: 700 }}>{pct(w)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Biggest disagreements" subtitle="Ranked by spread (coefficient of variation) across evaluators.">
        <div className="card">
          {model.divergence.slice(0, 3).map((d) => (
            <div className="row" key={d.criterion}>
              <i className="dot" style={{ background: crit(d.criterion).color }} />
              <div className="grow">
                <div className="headline" style={{ fontSize: '0.9375rem' }}>{crit(d.criterion).name}</div>
                <div className="footnote secondary">
                  {d.low.expert.role} {pct(d.low.w)} ↔ {d.high.expert.role} {pct(d.high.w)}
                </div>
              </div>
              <Badge tone={d.cv > 0.35 ? 'orange' : 'gray'}>Spread {(d.cv * 100).toFixed(0)}%</Badge>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Discussion agenda">
        {!state.discussion.prompts ? (
          <>
            <div className="hstack">
              <AIButton busy={ai.busy} busyLabel="Drafting…" onClick={draftPrompts}>Draft discussion prompts</AIButton>
              <span className="footnote secondary">Usually a facilitator spends most of a day preparing this.</span>
            </div>
            <ErrorNote error={ai.error} />
          </>
        ) : (
          <AICard
            title="Prompts for the consensus discussion"
            provenance={<Provenance result={result} step="group" />}
            footer={
              <>
                <Button variant="gray" onClick={() => { update((s) => ({ ...s, discussion: { ...s.discussion, prompts: null } })); log('reject', 'group', 'Discarded AI discussion prompts.'); }}>Discard</Button>
                <Button variant="filled" onClick={() => go('judgments')}>Revise judgments</Button>
              </>
            }
          >
            <div className="stack">
              {state.discussion.prompts.map((p, i) => {
                const key = `${p.criterion}-${i}`;
                return (
                  <div key={key} className="card pad" style={{ background: 'var(--bg-tertiary)', boxShadow: 'none' }}>
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      <span className="headline" style={{ fontSize: '0.9375rem' }}>{crit(p.criterion)?.name ?? p.criterion}</span>
                      <span className="hstack">
                        {p.addressedTo.map((id) => {
                          const e = (() => { try { return expertById(id); } catch { return null; } })();
                          return e ? <span key={id} title={e.role}><Avatar initials={e.initials} /></span> : null;
                        })}
                      </span>
                    </div>
                    <p style={{ margin: '8px 0 4px' }}>{p.question}</p>
                    <p className="footnote secondary" style={{ margin: 0 }}>{p.why}</p>
                    <div className="field" style={{ marginTop: 10 }}>
                      <label htmlFor={`note-${key}`}>Outcome (recorded in the decision document)</label>
                      <textarea
                        id={`note-${key}`}
                        className="input"
                        style={{ minHeight: 60 }}
                        placeholder="e.g. RAM and Sensor agreed sustained sorties matter more than peak range; RAM to revise."
                        value={state.discussion.notes[key] ?? ''}
                        onChange={(e) => update((s) => ({ ...s, discussion: { ...s.discussion, notes: { ...s.discussion.notes, [key]: e.target.value } } }))}
                        onBlur={(e) => e.target.value && log('note', 'group', `Discussion outcome on ${crit(p.criterion)?.short}: ${e.target.value}`)}
                      />
                    </div>
                    <div className="row" style={{ padding: '10px 0 0' }}>
                      <span className="grow subhead">Discussed</span>
                      <Toggle
                        checked={!!state.discussion.done[key]}
                        label={`Mark ${crit(p.criterion)?.short} discussed`}
                        onChange={(v) => update((s) => ({ ...s, discussion: { ...s.discussion, done: { ...s.discussion.done, [key]: v } } }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </AICard>
        )}
      </Section>
      <Pager here="group" />
    </>
  );
}
