import { useState } from 'react';
import { CR_LIMIT, buildMatrix, consistency, formatJudgment, mostInconsistentJudgment, pairIndex, snapToSaaty, type JudgmentFix } from '../ahp/engine';
import { ALTERNATIVES, CRITERIA, JUDGES, QUAL_LEAVES, expertById, leafCriterion, type CriterionId } from '../data/scenario';
import { PairwiseRow, WeightBars } from '../components/charts';
import { AICard, AIButton, Avatar, Badge, Button, Callout, ErrorNote, Pager, Provenance, Section, Segmented, StepHeader, useAI } from '../components/ui';
import { useStore } from '../state/store';
import type { CoachNote } from '../ai/demo';

type Tab = 'criteria' | 'sub' | 'alts';

export function CRBadge({ cr }: { cr: number }) {
  return cr <= CR_LIMIT ? <Badge tone="green">CR {cr.toFixed(2)}</Badge> : <Badge tone="orange">CR {cr.toFixed(2)} · over 0.10</Badge>;
}

export default function Judgments() {
  const { state, model, update } = useStore();
  const [tab, setTab] = useState<Tab>('criteria');
  const me = expertById(state.persona);

  if (state.hierarchy !== 'approved') {
    return (
      <>
        <StepHeader eyebrow="Step 4 of 8" title="Make judgments" lede="Approve the criteria first." />
        <Pager here="judgments" />
      </>
    );
  }

  return (
    <>
      <StepHeader
        eyebrow="Step 4 of 8"
        title="Make judgments"
        lede="Drag toward the item that matters more."
        ai={['Finds the cause of inconsistency']}
        human={['Every judgment']}
      />

      <Section title="Team status">
        <div className="card">
          {model.individuals.map((x) => (
            <div className="row" key={x.expert.id}>
              <Avatar initials={x.expert.initials} />
              <span className="grow">
                {x.expert.name} <span className="secondary">· {x.expert.role}</span>
              </span>
              <CRBadge cr={x.cr} />
              {state.persona === x.expert.id ? (
                <Badge tone="indigo">You</Badge>
              ) : (
                <Button small variant="plain" onClick={() => update((s) => ({ ...s, persona: x.expert.id }))} aria-label={`Act as ${x.expert.name}`}>
                  Act as
                </Button>
              )}
            </div>
          ))}
        </div>
      </Section>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          label="Judgment set"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'criteria', label: 'Criteria weights' },
            { value: 'sub', label: 'Sub-criteria' },
            { value: 'alts', label: 'Compare proposals' },
          ]}
        />
      </div>

      {tab === 'criteria' && (me.judges ? <CriteriaMatrix key={me.id} /> : <Callout title="The Source Selection Authority doesn’t weigh criteria">Keeping the decision-maker separate from the evaluation protects the integrity of the source selection. Switch to an evaluator to make judgments.</Callout>)}
      {tab === 'sub' && <SubCriteria />}
      {tab === 'alts' && <QualAlternatives />}
      <Pager here="judgments" />
    </>
  );
}

function CriteriaMatrix() {
  const { state, update, log } = useStore();
  const ai = useAI();
  const me = expertById(state.persona);
  const upper = state.judgments[me.id];
  const m = buildMatrix(CRITERIA.length, upper);
  const c = consistency(m);
  const [coach, setCoach] = useState<{ fix: JudgmentFix; note: CoachNote; result: any } | null>(null);
  const pairs = pairIndex(CRITERIA.length);
  const flagged = coach ? pairs.findIndex(([i, j]) => i === coach.fix.i && j === coach.fix.j) : -1;

  function set(k: number, v: number) {
    update((s) => {
      const next = s.judgments[me.id].slice();
      next[k] = v;
      return { ...s, judgments: { ...s.judgments, [me.id]: next } };
    });
  }

  async function runCoach() {
    const fix = mostInconsistentJudgment(m);
    if (!fix) return;
    const L = CRITERIA.map((x) => x.short);
    const supporting = CRITERIA.map((_, k) => k)
      .filter((k) => k !== fix.i && k !== fix.j)
      .map((k) => ({ k, implied: m[fix.i][k] * m[k][fix.j] }))
      .sort((a, b) => Math.abs(Math.log(b.implied) - Math.log(fix.current)) - Math.abs(Math.log(a.implied) - Math.log(fix.current)))
      .slice(0, 2)
      .map(({ k, implied }) => `${L[fix.i]} vs ${L[k]} = ${formatJudgment(m[fix.i][k])} and ${L[k]} vs ${L[fix.j]} = ${formatJudgment(m[k][fix.j])}, which together imply about ${formatJudgment(snapToSaaty(implied))}`);
    const facts = {
      expert: me.name,
      role: me.role,
      left: L[fix.i],
      right: L[fix.j],
      current: formatJudgment(fix.current),
      suggested: formatJudgment(fix.suggested),
      minimal: fix.minimal != null ? formatJudgment(fix.minimal) : null,
      crBefore: fix.crBefore,
      crAfter: fix.crAfter,
      crAfterMinimal: fix.crAfterMinimal,
      supporting,
    };
    const r = await ai.run('coach', facts);
    if (!r) return;
    setCoach({ fix, note: r.data as CoachNote, result: r });
    log('ai', 'judgments', `Consistency coach: ${me.name}'s ${L[fix.i]} vs ${L[fix.j]} (${facts.current}) is most out of line; CR ${fix.crBefore.toFixed(2)} → ${fix.crAfter.toFixed(2)} if ${facts.suggested}.`, 'ai');
  }

  function apply(v: number) {
    if (!coach) return;
    const k = pairs.findIndex(([i, j]) => i === coach.fix.i && j === coach.fix.j);
    set(k, v);
    log('accept', 'judgments', `${me.name} revised ${CRITERIA[coach.fix.i].short} vs ${CRITERIA[coach.fix.j].short}: ${formatJudgment(coach.fix.current)} → ${formatJudgment(v)}.`);
    setCoach(null);
  }

  return (
    <>
      <Section
        title={`${me.name}’s criteria comparisons`}
        action={<CRBadge cr={c.cr} />}
      >
        {c.cr > CR_LIMIT && !coach && (
          <div style={{ marginBottom: 12 }}>
            <Callout tone="warn" icon="warn" title="Inconsistent judgments (CR > 0.10)" action={<AIButton busy={ai.busy} busyLabel="Analysing…" onClick={runCoach}>Find the cause</AIButton>} />
            <ErrorNote error={ai.error} />
          </div>
        )}
        {coach && (
          <div style={{ marginBottom: 12 }}>
            <AICard
              title="Consistency coach"
              provenance={<Provenance result={coach.result} step="judgments" />}
              footer={
                <>
                  <Button variant="gray" onClick={() => { log('reject', 'judgments', `${me.name} kept ${CRITERIA[coach.fix.i].short} vs ${CRITERIA[coach.fix.j].short} at ${formatJudgment(coach.fix.current)} (intentional).`); setCoach(null); }}>
                    Keep my judgment
                  </Button>
                  {coach.fix.minimal != null && coach.fix.minimal !== coach.fix.suggested && (
                    <Button onClick={() => apply(coach.fix.minimal!)}>Use {formatJudgment(coach.fix.minimal)} (smallest change)</Button>
                  )}
                  <Button variant="filled" onClick={() => apply(coach.fix.suggested)}>Use {formatJudgment(coach.fix.suggested)}</Button>
                </>
              }
            >
              <p style={{ marginTop: 0 }}>{coach.note.explanation}</p>
              <p style={{ marginBottom: 0 }} className="secondary">{coach.note.question}</p>
            </AICard>
          </div>
        )}
        <div className="card">
          {pairs.map(([i, j], k) => (
            <PairwiseRow key={k} id={`p${k}`} left={CRITERIA[i].short} right={CRITERIA[j].short} value={upper[k]} flagged={k === flagged} onChange={(v) => set(k, v)} onCommit={(v) => log('judgment', 'judgments', `${me.name} set ${CRITERIA[i].short} vs ${CRITERIA[j].short} = ${formatJudgment(v)}.`)} />
          ))}
        </div>
      </Section>
      <Section title="Resulting weights">
        <div className="card" style={{ padding: '8px 0' }}>
          <WeightBars items={CRITERIA.map((cr, i) => ({ label: cr.short, value: c.weights[i], color: cr.color }))} />
        </div>
      </Section>
    </>
  );
}

function SubCriteria() {
  const { state, update, log } = useStore();
  const multi = CRITERIA.filter((c) => c.leaves.length > 1);
  return (
    <>
      {multi.map((c) => {
        const owner = c.owner === state.persona;
        const upper = state.area[c.id] ?? [];
        const cc = consistency(buildMatrix(c.leaves.length, upper));
        return (
          <Section key={c.id} title={c.name} subtitle={owner ? undefined : `Read-only · owned by ${expertById(c.owner).role}`} action={<CRBadge cr={cc.cr} />}>
            <div className="card">
              {pairIndex(c.leaves.length).map(([i, j], k) => (
                <PairwiseRow
                  key={k}
                  id={`${c.id}${k}`}
                  left={c.leaves[i].short}
                  right={c.leaves[j].short}
                  value={upper[k] ?? 1}
                  disabled={!owner}
                  onChange={(v) => {
                    update((s) => {
                      const next = (s.area[c.id] ?? []).slice();
                      next[k] = v;
                      return { ...s, area: { ...s.area, [c.id as CriterionId]: next } };
                    });
                  }}
                  onCommit={(v) => log('judgment', 'judgments', `${expertById(c.owner).name} set ${c.leaves[i].short} vs ${c.leaves[j].short} = ${formatJudgment(v)}.`)}
                />
              ))}
            </div>
            <div className="card" style={{ marginTop: 10, padding: '8px 0' }}>
              <WeightBars items={c.leaves.map((l, i) => ({ label: l.short, value: cc.weights[i], color: c.color }))} />
            </div>
          </Section>
        );
      })}
    </>
  );
}

function QualAlternatives() {
  const { state, update, log } = useStore();
  return (
    <>
      {QUAL_LEAVES.map((l) => {
        const cr = leafCriterion(l.id);
        const owner = cr.owner === state.persona;
        const upper = state.qual[l.id];
        const cc = consistency(buildMatrix(ALTERNATIVES.length, upper));
        return (
          <Section key={l.id} title={`${cr.short}: ${l.name}`} subtitle={owner ? undefined : `Read-only · owned by ${expertById(cr.owner).role}`} action={<CRBadge cr={cc.cr} />}>
            <div className="card">
              {pairIndex(ALTERNATIVES.length).map(([i, j], k) => (
                <PairwiseRow
                  key={k}
                  id={`${l.id}${k}`}
                  left={ALTERNATIVES[i].name}
                  right={ALTERNATIVES[j].name}
                  value={upper[k]}
                  disabled={!owner}
                  onChange={(v) => {
                    update((s) => {
                      const next = s.qual[l.id].slice();
                      next[k] = v;
                      return { ...s, qual: { ...s.qual, [l.id]: next } };
                    });
                  }}
                  onCommit={(v) => log('judgment', 'judgments', `${expertById(cr.owner).name} set ${ALTERNATIVES[i].name} vs ${ALTERNATIVES[j].name} on ${cr.short} = ${formatJudgment(v)}.`)}
                />
              ))}
            </div>
          </Section>
        );
      })}
      {!QUAL_LEAVES.some((l) => leafCriterion(l.id).owner === state.persona) && (
        <p className="footnote secondary">
          You don’t own a judged criterion. Act as {JUDGES.filter((e) => e.owns.some((o) => ['INTOP', 'RISK', 'CYBER'].includes(o))).map((e) => e.name).join(', ')} to edit these.
        </p>
      )}
    </>
  );
}
