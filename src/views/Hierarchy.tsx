import { useState } from 'react';
import { REQUIREMENTS_DOC } from '../data/docs';
import { CRITERIA, expertById } from '../data/scenario';
import { AICard, AIButton, Badge, Button, Callout, ErrorNote, Icon, Pager, Provenance, Section, StepHeader, useAI } from '../components/ui';
import { useStore } from '../state/store';
import type { HierarchyDraft } from '../state/types';

export default function Hierarchy() {
  const { state, update, log } = useStore();
  const ai = useAI();
  const [result, setResult] = useState<{ source: 'demo' | 'live'; model: string; ms: number } | null>(null);
  const isPM = state.persona === 'pm';
  const draft = state.hierarchyDraft;

  async function draftIt() {
    const r = await ai.run('hierarchy', undefined as void);
    if (!r) return;
    setResult(r);
    update((s) => ({ ...s, hierarchy: s.hierarchy === 'approved' ? 'approved' : 'drafted', hierarchyDraft: r.data as HierarchyDraft }));
    log('ai', 'hierarchy', `AI drafted a ${(r.data as HierarchyDraft).criteria.length}-criterion hierarchy from CDD excerpt (${r.source === 'demo' ? 'scripted demo' : r.model}).`, 'ai');
  }

  return (
    <>
      <StepHeader
        eyebrow="Step 2 of 8"
        title="Build the criteria"
        ai={['Drafts criteria from the requirements', 'Flags gaps and double counting']}
        human={['PM approves the hierarchy']}
      />

      <Section title="Requirements document">
        <div className="card pad">
          <pre className="source">{REQUIREMENTS_DOC}</pre>
        </div>
      </Section>

      {state.hierarchy === 'empty' && (
        <Section>
          <div className="hstack">
            <AIButton busy={ai.busy} busyLabel="Drafting…" onClick={draftIt}>Draft hierarchy from requirements</AIButton>
          </div>
          <div style={{ marginTop: 12 }}><ErrorNote error={ai.error} /></div>
        </Section>
      )}

      {draft && state.hierarchy === 'drafted' && (
        <Section>
          <AICard
            title="Draft criteria hierarchy"
            provenance={<Provenance result={result} step="hierarchy" />}
            footer={
              <>
                {!isPM && <span className="footnote secondary" style={{ marginRight: 'auto', alignSelf: 'center' }}>Only the Program Manager can approve.</span>}
                <Button variant="gray" onClick={() => { update((s) => ({ ...s, hierarchy: 'empty', hierarchyDraft: null })); log('reject', 'hierarchy', 'Discarded the AI hierarchy draft.'); }}>
                  Discard
                </Button>
                {isPM ? (
                  <Button variant="filled" onClick={() => { update((s) => ({ ...s, hierarchy: 'approved' })); log('accept', 'hierarchy', 'Approved the criteria hierarchy (7 criteria, 12 sub-criteria) after team review.'); }}>
                    <Icon name="check" /> Approve hierarchy
                  </Button>
                ) : (
                  <Button variant="filled" onClick={() => update((s) => ({ ...s, persona: 'pm' }))}>Switch to Program Manager</Button>
                )}
              </>
            }
          >
            <DraftView draft={draft} />
            {ai.live && (
              <p className="footnote secondary" style={{ marginTop: 12 }}>
                Live draft for comparison. The demo keeps its fixed 7-criterion structure.
              </p>
            )}
          </AICard>
        </Section>
      )}

      {state.hierarchy === 'approved' && (
        <>
          <Callout tone="ok" icon="check" title={`Approved by ${expertById('pm').name}, Program Manager`}>
            Criteria are fixed for this evaluation. Changing them later means every evaluator has to redo their judgments.
          </Callout>
          <div style={{ height: 20 }} />
          <Section title="Approved hierarchy">
            <div className="card">
              <ul className="tree">
                {CRITERIA.map((c) => (
                  <li key={c.id}>
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      <span className="hstack">
                        <i className="dot" style={{ background: c.color }} />
                        <span className="headline">{c.name}</span>
                        <span className="footnote tertiary">{c.reqRef}</span>
                      </span>
                      <Badge tone="blue">{expertById(c.owner).role}</Badge>
                    </div>
                    <ul>
                      {c.leaves.map((l) => (
                        <li key={l.id}>
                          {l.name}{' '}
                          {l.kind === 'quant' ? (
                            <span className="secondary footnote">
                              · threshold {l.threshold} {l.unit}, objective {l.objective} {l.unit}
                              {l.kpp && <> · <Badge tone="orange">KPP</Badge></>}
                            </span>
                          ) : (
                            <span className="secondary footnote">· compared head-to-head by the owner</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
          {draft && (
            <details className="card pad" style={{ marginBottom: 20 }}>
              <summary className="headline" style={{ cursor: 'pointer', minHeight: 32 }}>AI rationale and gaps it raised</summary>
              <div style={{ marginTop: 12 }}><DraftView draft={draft} /></div>
            </details>
          )}
        </>
      )}
      <Pager here="hierarchy" />
    </>
  );
}

function DraftView({ draft }: { draft: HierarchyDraft }) {
  return (
    <div className="stack">
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {draft.criteria.map((c) => (
          <li key={c.name} style={{ marginBottom: 10 }}>
            <span className="headline">{c.name}</span> <span className="footnote tertiary">{c.reqRef}</span>
            <div className="footnote secondary">{c.rationale}</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }} className="subhead">
              {c.subcriteria.map((s) => (
                <li key={s.name}>
                  {s.name} <span className="secondary">— {s.measure}{s.threshold ? `; T ${s.threshold}, O ${s.objective}` : ''}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div>
        <p className="headline" style={{ fontSize: '0.9375rem' }}>Screening rules (pass/fail before scoring)</p>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }} className="subhead">{draft.screeningRules.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <div>
        <p className="headline" style={{ fontSize: '0.9375rem' }}>For the team to resolve</p>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }} className="subhead">{draft.gaps.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
    </div>
  );
}
