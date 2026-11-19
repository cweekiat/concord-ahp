import { useState } from 'react';
import { Button, ConfirmSheet, Icon, Pager, Section, useNav } from '../components/ui';
import { initialState, preparedState, useStore } from '../state/store';
import { totals, DEFAULT_SAVINGS } from '../data/savings';
import type { StepId } from '../state/types';

const FLOW: Array<{ step: StepId; n: number; title: string; ai: string; human: string }> = [
  { step: 'setup', n: 1, title: 'Set up', ai: '—', human: 'Define the goal, proposals and evaluation team' },
  { step: 'hierarchy', n: 2, title: 'Criteria', ai: 'Drafts the criteria tree from the requirements document, citing each paragraph', human: 'Program Manager approves the hierarchy' },
  { step: 'evidence', n: 3, title: 'Evidence', ai: 'Pulls values out of datasheets, converts units and flags anything doubtful', human: 'Criterion owners check each value; KPP screening is confirmed' },
  { step: 'judgments', n: 4, title: 'Judgments', ai: 'Finds the judgment behind an inconsistency and explains it', human: 'Every pairwise judgment, made by each evaluator on their own' },
  { step: 'group', n: 5, title: 'Group view', ai: 'Shows where people disagree and drafts questions for the discussion', human: 'The team talks it through; evaluators revise if they choose' },
  { step: 'scoring', n: 6, title: 'Scoring', ai: '—', human: 'Owners compare proposals on the criteria that have no numbers' },
  { step: 'results', n: 7, title: 'Results', ai: 'Explains which weight changes would change the ranking', human: 'The team checks whether the result holds up' },
  { step: 'decision', n: 8, title: 'Decision', ai: 'Drafts the decision document with every number traced to its source', human: 'The Source Selection Authority decides and signs' },
];

export default function Overview() {
  const { go } = useNav();
  const { state, replace, update } = useStore();
  const t = totals(DEFAULT_SAVINGS);
  const [confirmReset, setConfirmReset] = useState(false);
  const started = state.hierarchy !== 'empty' || Object.keys(state.evidence).length > 0;

  return (
    <>
      <div className="hero">
        <p className="eyebrow">Analytic Hierarchy Process · AI-assisted · Demo</p>
        <h1>Better team decisions on complex buys, with AI doing the groundwork.</h1>
        <p className="lede">
          Concord runs a structured AHP evaluation for an acquisition team: performance engineers, reliability and logistics specialists, cost analysts and operators.
          The AI reads documents, checks the maths and drafts the paperwork. It never judges or decides.
        </p>
        <div className="hstack">
          <Button variant="filled" onClick={() => go(started ? 'hierarchy' : 'setup')}>
            {started ? 'Continue the walkthrough' : 'Start the walkthrough'} <Icon name="chevronRight" />
          </Button>
          <Button
            variant="gray"
            onClick={() => {
              update((s) => preparedState(s));
              go('judgments');
            }}
          >
            Skip to judgments
          </Button>
        </div>
      </div>

      <p className="principle">The AI drafts and checks. People judge and decide.</p>

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="card stat">
          <div className="label">Demo scenario</div>
          <div className="value" style={{ fontSize: '1.25rem' }}>EO/IR sensor turret</div>
          <div className="footnote secondary">Maritime patrol UAS · 4 proposals · 9-person team</div>
        </div>
        <div className="card stat">
          <div className="label">Analyst and meeting time (illustrative)</div>
          <div className="value">−{(t.savedPct * 100).toFixed(0)}%</div>
          <div className="footnote secondary">{t.manualHours.toFixed(0)} h → {t.aiHours.toFixed(0)} h · <button className="btn plain small link-inline" onClick={() => go('savings')}>See the model</button></div>
        </div>
        <div className="card stat">
          <div className="label">Expert judgment time</div>
          <div className="value">Unchanged</div>
          <div className="footnote secondary">Kept the same on purpose. That’s the part people own.</div>
        </div>
      </div>

      <Section title="How the work is split" subtitle="Eight screens cover the full AHP process, following DoD source selection practice.">
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col"><span style={{ color: 'var(--indigo-text)' }}>AI prepares</span></th>
                <th scope="col"><span style={{ color: 'var(--green-text)' }}>People decide</span></th>
              </tr>
            </thead>
            <tbody>
              {FLOW.map((f) => (
                <tr key={f.step}>
                  <th scope="row" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn plain small" onClick={() => go(f.step)} style={{ paddingLeft: 0 }}>
                      {f.n}. {f.title}
                    </button>
                  </th>
                  <td className="secondary">{f.ai}</td>
                  <td>{f.human}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Where it fits in DoD acquisition">
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr><th scope="col">DoD construct</th><th scope="col">In Concord</th></tr>
            </thead>
            <tbody>
              <tr><td>Capability Development Document (KPPs, KSAs)</td><td>Source for the criteria; thresholds become screening rules and value functions</td></tr>
              <tr><td>Evaluation factors and subfactors</td><td>AHP criteria hierarchy</td></tr>
              <tr><td>Source Selection Evaluation Board (SSEB)</td><td>Evaluators, each owning the criteria in their specialty</td></tr>
              <tr><td>Source Selection Advisory Council (SSAC)</td><td>Group view: aggregation, disagreement and sensitivity</td></tr>
              <tr><td>Source Selection Authority (SSA)</td><td>Makes and signs the decision; may depart from the ranking with a written rationale</td></tr>
              <tr><td>Source Selection Decision Document</td><td>AI drafts it, people edit it, and it’s exported with a full audit log</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <p className="footnote secondary">
        Everything in this demo is fictional: the programme, vendors, products, people and numbers. AI responses are scripted unless you add your own Claude API key in Settings.
        {started && (
          <>
            {' '}
            <button className="btn plain small link-inline" onClick={() => setConfirmReset(true)}>
              Start over
            </button>
          </>
        )}
      </p>
      <ConfirmSheet
        open={confirmReset}
        title="Start Over?"
        message="This clears the evaluation in this browser: approvals, verified evidence, judgment changes, the decision document and the audit log. It can’t be undone. Export a copy first from Settings if you want to keep it."
        confirmLabel="Start Over"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { replace(initialState()); setConfirmReset(false); go('overview'); }}
      />
      <Pager here="overview" />
    </>
  );
}
