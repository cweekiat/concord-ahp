import { useState } from 'react';
import { CR_LIMIT } from '../ahp/engine';
import { ALTERNATIVES, CRITERIA, EXPERTS, JUDGES, PROGRAMME, QUANT_LEAVES, altById, expertById, type AltId } from '../data/scenario';
import { AICard, AIButton, Badge, Button, Callout, ErrorNote, Gate, Icon, Markdown, Pager, Provenance, Section, Segmented, StepHeader, pct, useAI } from '../components/ui';
import { exportJSON, useStore } from '../state/store';
import { cellKey } from '../state/types';
import { sensitivityFacts } from './Results';
import type { MemoFacts } from '../ai/demo';

function download(name: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Decision() {
  const { state, model, update, log } = useStore();
  const ai = useAI();
  const [view, setView] = useState<'preview' | 'edit'>('preview');
  const [result, setResult] = useState<any>(null);
  const [pick, setPick] = useState<AltId | null>(state.decision?.alt ?? null);
  const [why, setWhy] = useState(state.decision?.rationale ?? '');

  if (!model.ready) {
    return (
      <>
        <StepHeader eyebrow="Step 8 of 8" title="Decide" lede="Finish the earlier steps first." />
        <Gate blockers={model.blockers} />
        <Pager here="decision" />
      </>
    );
  }

  const top = model.ranking[0].alt;
  const isSSA = state.persona === 'ssa';
  const departs = pick != null && pick !== top;

  function facts(): MemoFacts {
    const sf = sensitivityFacts(model);
    const notes = Object.entries(state.discussion.notes).filter(([, v]) => v.trim());
    const evidenceNotes = QUANT_LEAVES.flatMap((l) =>
      ALTERNATIVES.map((a) => ({ a, l, c: state.evidence[cellKey(a.id, l.id)] }))
        .filter((x) => x.c?.correctedFrom != null || x.c?.flag)
        .map((x) => (x.c!.correctedFrom != null ? `${x.a.name} ${x.l.short}: AI extracted ${x.c!.correctedFrom}, corrected to ${x.c!.value} ${x.l.unit} by ${expertById(x.c!.verifiedBy!).role}.` : `${x.a.name} ${x.l.short} (${x.c!.value} ${x.l.unit}): ${x.c!.flag} Verified by ${expertById(x.c!.verifiedBy ?? 'pm').role}.`)),
    );
    return {
      programme: PROGRAMME.name,
      goal: state.goal,
      date: new Date().toISOString().slice(0, 10),
      alternatives: ALTERNATIVES.map((a) => `${a.vendor} ${a.name}`),
      screenedOut: model.screening.filter((x) => x.status === 'fail').map((x) => ({ name: altById(x.alt).name, reasons: x.failures.map((f) => `${f.name} misses the ${f.threshold} ${f.unit} threshold (${f.reqRef})`) })),
      team: JUDGES.map((e) => e.role),
      inconsistentNotes: [
        ...model.individuals.filter((x) => x.cr > CR_LIMIT).map((x) => `${x.expert.role}: CR ${x.cr.toFixed(2)}, ${model.included.includes(x) ? 'included' : 'excluded'} in aggregation.`),
        ...state.audit.filter((e) => e.step === 'judgments' && (e.kind === 'accept' || e.kind === 'reject')).map((e) => `Consistency review: ${e.summary}`),
      ],
      groupCR: model.groupCR,
      weights: CRITERIA.map((c, i) => ({ name: c.name, w: model.W[i] })),
      ranking: model.ranking.map((r) => ({ name: `${altById(r.alt).vendor} ${altById(r.alt).name}`, score: r.score })),
      discriminators: CRITERIA.map((c, ci) => {
        const scores = model.active.map((a, ai) => ({ a, s: model.S[ci][ai] }));
        const best = scores.reduce((x, y) => (y.s > x.s ? y : x));
        return { c, best, contrib: model.W[ci] * (best.s - Math.min(...scores.map((x) => x.s))) };
      })
        .sort((x, y) => y.contrib - x.contrib)
        .slice(0, 4)
        .map((d) => `${d.c.name} (${pct(model.W[CRITERIA.indexOf(d.c)])} weight): ${altById(d.best.a).name} scores best.`),
      sensitivity: state.sensitivityNote?.summary ?? (sf.reversals.length ? `Closest reversal: ${sf.reversals[0].criterion} at ${pct(sf.reversals[0].at)}.` : null),
      disagreements: notes.map(([k, v]) => `${CRITERIA.find((c) => k.startsWith(c.id))?.name ?? k}: ${v}`),
      evidenceNotes,
    };
  }

  async function draft() {
    const r = await ai.run('memo', facts());
    if (!r) return;
    setResult(r);
    update((s) => ({ ...s, memo: r.data as string }));
    log('ai', 'decision', 'AI drafted the Source Selection Decision Document from the evaluation record.', 'ai');
  }

  function sign() {
    if (!pick || !why.trim()) return;
    const d = { alt: pick, rationale: why.trim(), signedBy: state.persona, at: new Date().toISOString(), followsRanking: pick === top };
    update((s) => ({
      ...s,
      decision: d,
      memo: s.memo ? s.memo.replace(/## 9\. Decision[\s\S]*$/, `## 9. Decision\n**Selected: ${altById(pick).vendor} ${altById(pick).name}.** ${d.followsRanking ? 'This matches the highest-ranked proposal.' : 'This departs from the AHP ranking.'}\n\n${d.rationale}\n\n— ${expertById('ssa').name}, Source Selection Authority, ${d.at.slice(0, 10)}\n`) : s.memo,
    }));
    log('decision', 'decision', `SSA selected ${altById(pick).name}${pick === top ? ' (matches ranking)' : ' (departs from ranking)'}: ${why.trim()}`);
  }

  return (
    <>
      <StepHeader
        eyebrow="Step 8 of 8"
        title="Decide"
        ai={['Drafts the decision document']}
        human={['SSA selects and signs']}
      />

      <Section title="Decision document" action={state.memo ? <Segmented label="Document view" value={view} onChange={setView} options={[{ value: 'preview', label: 'Preview' }, { value: 'edit', label: 'Edit' }]} /> : undefined}>
        {!state.memo ? (
          <>
            <div className="hstack">
              <AIButton busy={ai.busy} busyLabel="Drafting…" onClick={draft}>Draft the decision document</AIButton>
            </div>
            <ErrorNote error={ai.error} />
          </>
        ) : (
          <AICard
            title="Source Selection Decision Document (draft)"
            provenance={result ? <Provenance result={result} step="decision" /> : <span className="provenance">Edited by people since it was drafted.</span>}
            footer={
              <>
                <Button variant="gray" onClick={draft} disabled={ai.busy}>Redraft</Button>
                <Button onClick={() => download('tern-ssdd-draft.md', state.memo!)}>
                  <Icon name="download" /> Download .md
                </Button>
              </>
            }
          >
            {view === 'preview' ? (
              <Markdown text={state.memo} />
            ) : (
              <>
                <label className="sr-only" htmlFor="memo">Decision document (Markdown)</label>
                <textarea id="memo" className="input mono" style={{ minHeight: 480, fontSize: '0.8125rem' }} value={state.memo} onChange={(e) => update((s) => ({ ...s, memo: e.target.value }))} onBlur={() => log('edit', 'decision', 'Edited the decision document.')} />
              </>
            )}
          </AICard>
        )}
      </Section>

      <Section title="Source Selection Authority" subtitle={`${expertById('ssa').name}`}>
        {state.decision ? (
          <Callout tone="ok" icon="signature" title={`Signed: ${altById(state.decision.alt).vendor} ${altById(state.decision.alt).name}`} action={isSSA ? <Button small variant="plain" onClick={() => { update((s) => ({ ...s, decision: null })); log('edit', 'decision', 'SSA withdrew the signature to revise the decision.'); }}>Revise</Button> : undefined}>
            <p>{state.decision.rationale}</p>
            <p className="footnote">
              {expertById(state.decision.signedBy).name} · {new Date(state.decision.at).toLocaleString()} · {state.decision.followsRanking ? 'Matches the AHP ranking' : 'Departs from the AHP ranking'}
            </p>
          </Callout>
        ) : !isSSA ? (
          <Callout title="Only the Source Selection Authority can sign" action={<Button onClick={() => update((s) => ({ ...s, persona: 'ssa' }))}>Act as SSA</Button>}>
            Evaluators prepare and advise. The decision is the SSA’s alone.
          </Callout>
        ) : (
          <div className="card pad stack">
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="headline" style={{ marginBottom: 8 }}>Select a proposal</legend>
              <div className="stack" style={{ gap: 8 }}>
                {model.ranking.map((r, i) => (
                  <label key={r.alt} className="row card" style={{ cursor: 'pointer', boxShadow: 'none', background: pick === r.alt ? 'color-mix(in srgb, var(--tint) 10%, var(--bg-tertiary))' : 'var(--bg-tertiary)' }}>
                    <input type="radio" name="pick" value={r.alt} checked={pick === r.alt} onChange={() => setPick(r.alt)} style={{ width: 20, height: 20 }} />
                    <span className="grow">
                      {altById(r.alt).vendor} {altById(r.alt).name} <span className="secondary footnote">· rank {i + 1} · {r.score.toFixed(3)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="why">{departs ? 'Rationale (required): why depart from the ranking?' : 'Rationale (required)'}</label>
              <textarea id="why" className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="State the reasons in your own words. This goes into the decision record exactly as written." />
            </div>
            {departs && <Callout tone="warn" icon="warn" title="You are departing from the AHP ranking">That’s allowed. The written rationale has to explain what the model doesn’t capture.</Callout>}
            <div className="hstack" style={{ justifyContent: 'flex-end' }}>
              <Button variant="filled" disabled={!pick || !why.trim()} onClick={sign}>
                <Icon name="signature" /> Sign decision
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Export the record">
        <div className="hstack">
          <Button onClick={() => download('tern-evaluation.json', exportJSON(state), 'application/json')}><Icon name="download" /> Evaluation (.json)</Button>
          <Badge>{state.audit.length} audit entries</Badge>
          <Badge>{EXPERTS.length} people</Badge>
        </div>
      </Section>
      <Pager here="decision" />
    </>
  );
}
