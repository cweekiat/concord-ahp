import { useState, type ReactNode } from 'react';
import { DATASHEETS, COST_ESTIMATE_NOTE } from '../data/docs';
import { ALTERNATIVES, QUANT_LEAVES, altById, expertById, leafCriterion, type AltId } from '../data/scenario';
import type { ExtractionRow } from '../ai/demo';
import { AIButton, Badge, Button, Callout, ErrorNote, Gate, Icon, Pager, Provenance, Section, Segmented, Sheet, StepHeader, useAI } from '../components/ui';
import { useStore } from '../state/store';
import { cellKey, type EvidenceCell } from '../state/types';
import { meetsThreshold } from '../ahp/engine';

const fmt = (v: number | null | undefined) => (v == null ? '—' : Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));

export default function Evidence() {
  const { state, model, update, log } = useStore();
  const ai = useAI();
  const [result, setResult] = useState<{ source: 'demo' | 'live'; model: string; ms: number } | null>(null);
  const [open, setOpen] = useState<{ alt: AltId; leaf: string } | null>(null);
  const [doc, setDoc] = useState<AltId>('A');
  const me = expertById(state.persona);
  const extracted = Object.keys(state.evidence).length > 0;

  if (state.hierarchy !== 'approved') {
    return (
      <>
        <StepHeader eyebrow="Step 3 of 8" title="Gather the evidence" lede="Approve the criteria first." />
        <Gate blockers={['The criteria hierarchy has not been approved.']} />
        <Pager here="evidence" />
      </>
    );
  }

  async function extract() {
    const r = await ai.run('evidence', undefined as void);
    if (!r) return;
    setResult(r);
    const rows = r.data as ExtractionRow[];
    update((s) => {
      const evidence = { ...s.evidence };
      for (const x of rows) {
        const k = cellKey(x.alt, x.leaf);
        if (evidence[k]?.status === 'verified') continue;
        evidence[k] = { value: x.value, aiValue: x.value, status: 'ai', quote: x.quote, source: x.source, confidence: x.confidence, flag: x.flag, flagKind: x.flagKind };
      }
      return { ...s, evidence };
    });
    const flags = rows.filter((x) => x.flag).length;
    log('ai', 'evidence', `AI extracted ${rows.length} values from 4 vendor documents and the cost estimate, and flagged ${flags} for review.`, 'ai');
  }

  const myUnflagged = QUANT_LEAVES.filter((l) => leafCriterion(l.id).owner === state.persona).flatMap((l) =>
    ALTERNATIVES.map((a) => ({ k: cellKey(a.id, l.id), c: state.evidence[cellKey(a.id, l.id)] })).filter((x) => x.c?.status === 'ai' && !x.c.flag),
  );

  function verifyMine() {
    update((s) => {
      const evidence = { ...s.evidence };
      for (const x of myUnflagged) evidence[x.k] = { ...evidence[x.k], status: 'verified', verifiedBy: s.persona };
      return { ...s, evidence };
    });
    log('verify', 'evidence', `Checked ${myUnflagged.length} unflagged values against their sources and verified them.`);
  }

  const owners = Array.from(new Set(QUANT_LEAVES.map((l) => leafCriterion(l.id).owner)));
  const pendingByOwner = owners
    .map((o) => ({ o, n: QUANT_LEAVES.filter((l) => leafCriterion(l.id).owner === o).reduce((n, l) => n + ALTERNATIVES.filter((a) => state.evidence[cellKey(a.id, l.id)]?.status !== 'verified').length, 0) }))
    .filter((x) => x.n > 0);

  return (
    <>
      <StepHeader
        eyebrow="Step 3 of 8"
        title="Gather the evidence"
        ai={['Extracts values with source quotes', 'Flags conflicts and KPP breaches']}
        human={['Owners verify each value', 'PM confirms screening']}
      />

      {!extracted && (
        <Section>
          <div className="hstack">
            <AIButton busy={ai.busy} busyLabel="Extracting…" onClick={extract}>Extract values from documents</AIButton>
          </div>
          <div style={{ marginTop: 12 }}><ErrorNote error={ai.error} /></div>
        </Section>
      )}

      {extracted && (
        <>
          <Section
            title="Evidence table"
            subtitle={`${model.evidenceVerified}/${model.evidenceTotal} verified`}
            action={
              myUnflagged.length > 0 ? (
                <Button small onClick={verifyMine}>
                  <Icon name="check" size={16} /> Verify my {myUnflagged.length} unflagged
                </Button>
              ) : undefined
            }
            footer={<Provenance result={result} step="evidence" />}
          >
            <div className="card table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    {ALTERNATIVES.map((a) => <th scope="col" key={a.id}>{a.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {QUANT_LEAVES.map((l) => (
                    <tr key={l.id}>
                      <th scope="row" style={{ fontWeight: 400 }}>
                        <div>{l.short} <span className="secondary footnote">({l.unit})</span></div>
                        <div className="caption tertiary">Owner: {expertById(leafCriterion(l.id).owner).role}</div>
                      </th>
                      {ALTERNATIVES.map((a) => {
                        const c = state.evidence[cellKey(a.id, l.id)];
                        const fails = c?.value != null && l.kpp && !meetsThreshold(c.value, l.threshold!, l.direction!);
                        return (
                          <td key={a.id} style={{ padding: 2 }}>
                            <button className="cell-btn" onClick={() => setOpen({ alt: a.id, leaf: l.id })} aria-label={`${a.name} ${l.short}: ${fmt(c?.value)} ${l.unit}, ${statusText(c)}${fails ? ', fails KPP threshold' : ''}`}>
                              <span className="num hstack" style={{ fontWeight: 600, gap: 4, color: fails ? 'var(--red-text)' : undefined }}>{fails && <Icon name="xmark" size={14} />}{fmt(c?.value)}</span>
                              <StatusIcon c={c} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legend" style={{ padding: '10px 4px 0' }}>
              <span><span style={{ color: 'var(--green-text)' }}><Icon name="check" size={14} /></span>Verified by owner</span>
              <span><span style={{ color: 'var(--indigo-text)' }}><Icon name="sparkles" size={14} /></span>AI value, not yet checked</span>
              <span><span style={{ color: 'var(--orange-text)' }}><Icon name="flag" size={14} /></span>Flagged for attention</span>
              <span><span style={{ color: 'var(--red-text)' }}><Icon name="xmark" size={14} /></span>Fails a KPP threshold</span>
            </div>
          </Section>

          {pendingByOwner.length > 0 && (
            <Section title="Waiting on">
              <div className="card">
                {pendingByOwner.map(({ o, n }) => (
                  <div className="row" key={o}>
                    <span className="grow">{expertById(o).name} <span className="secondary">· {expertById(o).role}</span></span>
                    <Badge tone="orange">{n} to check</Badge>
                    {state.persona !== o && <Button small variant="plain" onClick={() => update((s) => ({ ...s, persona: o }))}>Act as</Button>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="KPP screening">
            <div className="card">
              {model.screening.map((x) => (
                <div className="row" key={x.alt}>
                  <i className="dot" style={{ background: altById(x.alt).color }} />
                  <span className="grow">{altById(x.alt).vendor} {altById(x.alt).name}</span>
                  {x.status === 'unknown' && <Badge>Waiting for verified KPP values</Badge>}
                  {x.status === 'pass' && <Badge tone="green">Meets all KPPs</Badge>}
                  {x.status === 'fail' && <Badge tone="red">Fails: {x.failures.map((f) => f.short).join(', ')}</Badge>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              {state.screeningConfirmed ? (
                <Callout tone="ok" icon="check" title="Screening confirmed by the Program Manager" action={<Button small variant="plain" onClick={() => { update((s) => ({ ...s, screeningConfirmed: false })); log('edit', 'evidence', 'Reopened screening.'); }}>Reopen</Button>}>
                  {model.screening.filter((x) => x.status === 'fail').map((x) => altById(x.alt).name).join(', ') || 'No proposals'} removed from scoring.
                </Callout>
              ) : model.screening.some((x) => x.status === 'unknown') ? (
                <p className="footnote secondary">Screening can be confirmed once all KPP values are verified.</p>
              ) : state.persona === 'pm' ? (
                <Button variant="filled" onClick={() => { update((s) => ({ ...s, screeningConfirmed: true })); log('accept', 'evidence', `Confirmed KPP screening: ${model.screening.filter((x) => x.status === 'fail').map((x) => altById(x.alt).name).join(', ') || 'none'} screened out.`); }}>
                  Confirm screening
                </Button>
              ) : (
                <Button onClick={() => update((s) => ({ ...s, persona: 'pm' }))}>Switch to Program Manager to confirm</Button>
              )}
            </div>
          </Section>
        </>
      )}

      <Section title="Source documents">
        <div style={{ marginBottom: 10 }}>
          <Segmented label="Source document" value={doc} onChange={setDoc} options={ALTERNATIVES.map((a) => ({ value: a.id, label: a.name }))} />
        </div>
        <div className="card pad">
          <p className="headline" style={{ fontSize: '0.9375rem', marginBottom: 8 }}>{DATASHEETS[doc].title}</p>
          <pre className="source">{DATASHEETS[doc].text}</pre>
        </div>
      </Section>

      {open && <CellSheet alt={open.alt} leaf={open.leaf} onClose={() => setOpen(null)} />}
      <Pager here="evidence" />
    </>
  );
}

function statusText(c?: EvidenceCell) {
  if (!c || c.status === 'empty') return 'not extracted';
  if (c.status === 'verified') return 'verified';
  return c.flag ? 'flagged, needs review' : 'AI value, not checked';
}

function StatusIcon({ c }: { c?: EvidenceCell }) {
  if (!c) return null;
  if (c.status === 'verified') return <span style={{ color: 'var(--green-text)' }}><Icon name="check" size={16} /></span>;
  if (c.flag) return <span style={{ color: 'var(--orange-text)' }}><Icon name="flag" size={16} /></span>;
  return <span style={{ color: 'var(--indigo-text)' }}><Icon name="sparkles" size={16} /></span>;
}

function highlight(text: string, quote?: string): ReactNode {
  if (!quote) return text;
  const i = text.indexOf(quote);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{quote}</mark>
      {text.slice(i + quote.length)}
    </>
  );
}

function CellSheet({ alt, leaf, onClose }: { alt: AltId; leaf: string; onClose: () => void }) {
  const { state, update, log } = useStore();
  const l = QUANT_LEAVES.find((x) => x.id === leaf)!;
  const a = altById(alt);
  const owner = leafCriterion(leaf).owner;
  const k = cellKey(alt, leaf);
  const c = state.evidence[k];
  const [val, setVal] = useState(c?.value != null ? String(c.value) : '');
  const isOwner = state.persona === owner;
  const isCost = leaf === 'lcc';

  function verify() {
    const v = Number(val);
    if (!Number.isFinite(v)) return;
    const corrected = c?.aiValue != null && Math.abs(v - c.aiValue) > 1e-9;
    update((s) => ({ ...s, evidence: { ...s.evidence, [k]: { ...(s.evidence[k] ?? { status: 'empty' }), value: v, status: 'verified', verifiedBy: s.persona, correctedFrom: corrected ? c?.aiValue : undefined } } }));
    log('verify', 'evidence', corrected ? `Corrected ${a.name} ${l.short}: AI ${c?.aiValue} → ${v} ${l.unit}.` : `Verified ${a.name} ${l.short} = ${v} ${l.unit}${c?.flag ? ' (flag reviewed)' : ''}.`);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${a.name} · ${l.short}`}
      footer={
        isOwner ? (
          <Button variant="filled" onClick={verify} disabled={val === '' || !Number.isFinite(Number(val))}>
            <Icon name="check" /> {c?.aiValue != null && Number(val) !== c.aiValue ? 'Save correction' : 'Verify value'}
          </Button>
        ) : (
          <>
            <span className="footnote secondary" style={{ marginRight: 'auto', alignSelf: 'center' }}>Only the {expertById(owner).role} can verify this.</span>
            <Button onClick={() => update((s) => ({ ...s, persona: owner }))}>Act as {expertById(owner).name}</Button>
          </>
        )
      }
    >
      <div className="stack">
        <div className="hstack">
          {c?.status === 'verified' ? <Badge tone="green">Verified by {expertById(c.verifiedBy!).name}</Badge> : c ? <Badge tone="indigo">AI extracted · confidence {Math.round((c.confidence ?? 0) * 100)}%</Badge> : <Badge>Not extracted</Badge>}
          {l.kpp && <Badge tone="orange">KPP</Badge>}
          <span className="footnote secondary">Threshold {l.threshold} · Objective {l.objective} {l.unit}</span>
        </div>
        {c?.flag && (
          <Callout tone="warn" icon="flag" title="AI flag">{c.flag}</Callout>
        )}
        {c?.correctedFrom != null && <p className="footnote secondary">Corrected by a person (AI had {c.correctedFrom}).</p>}
        <div className="field">
          <label htmlFor="val">Value ({l.unit})</label>
          <input id="val" className="input num" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} disabled={!isOwner} />
        </div>
        {c?.source && (
          <div>
            <p className="footnote secondary" style={{ margin: '0 0 6px' }}>Source: {c.source}</p>
            <pre className="source">{isCost ? `${COST_ESTIMATE_NOTE}\n\n${c.quote}` : highlight(DATASHEETS[alt].text, c.quote)}</pre>
          </div>
        )}
      </div>
    </Sheet>
  );
}
