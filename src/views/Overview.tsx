import { useState } from 'react';
import { Button, ConfirmSheet, Icon, Pager, Section, Sheet, useNav } from '../components/ui';
import { initialState, preparedState, useStore } from '../state/store';
import { totals, DEFAULT_SAVINGS } from '../data/savings';
import type { StepId } from '../state/types';

const FLOW: Array<{ step: StepId; n: number; title: string; ai: string; human: string }> = [
  { step: 'setup', n: 1, title: 'Set up', ai: '—', human: 'Goal, proposals, team' },
  { step: 'hierarchy', n: 2, title: 'Criteria', ai: 'Drafts criteria from requirements', human: 'PM approves' },
  { step: 'evidence', n: 3, title: 'Evidence', ai: 'Extracts and flags datasheet values', human: 'Owners verify; PM confirms screening' },
  { step: 'judgments', n: 4, title: 'Judgments', ai: 'Finds the cause of inconsistency', human: 'Every pairwise judgment' },
  { step: 'group', n: 5, title: 'Group view', ai: 'Drafts discussion prompts', human: 'Team discusses and revises' },
  { step: 'scoring', n: 6, title: 'Scoring', ai: '—', human: 'Owners compare judged criteria' },
  { step: 'results', n: 7, title: 'Results', ai: 'Explains rank-change points', human: 'Judge robustness' },
  { step: 'decision', n: 8, title: 'Decision', ai: 'Drafts the decision document', human: 'SSA decides and signs' },
];

export default function Overview() {
  const { go, startTour } = useNav();
  const { state, replace, update } = useStore();
  const t = totals(DEFAULT_SAVINGS);
  const [confirmReset, setConfirmReset] = useState(false);
  const [video, setVideo] = useState(false);
  const started = state.hierarchy !== 'empty' || Object.keys(state.evidence).length > 0;

  return (
    <>
      <div className="hero">
        <p className="eyebrow">Demo · Project TERN EO/IR sensor</p>
        <h1>Concord</h1>
        <p className="lede">Team AHP evaluation for complex acquisitions, with AI doing the groundwork.</p>
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
          <Button variant="plain" onClick={() => setVideo(true)}>▶︎ Watch demo (30 s)</Button>
          <Button variant="plain" onClick={startTour}>Take the tour</Button>
        </div>
      </div>

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
        </div>
      </div>

      <Section title="How the work is split">
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

      <Section title="DoD mapping">
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr><th scope="col">DoD construct</th><th scope="col">In Concord</th></tr>
            </thead>
            <tbody>
              <tr><td>Capability Development Document (KPPs, KSAs)</td><td>Criteria, thresholds, screening</td></tr>
              <tr><td>Evaluation factors and subfactors</td><td>AHP criteria hierarchy</td></tr>
              <tr><td>Source Selection Evaluation Board (SSEB)</td><td>Evaluators owning criteria</td></tr>
              <tr><td>Source Selection Advisory Council (SSAC)</td><td>Group view and results</td></tr>
              <tr><td>Source Selection Authority (SSA)</td><td>Signs the decision</td></tr>
              <tr><td>Source Selection Decision Document</td><td>AI draft, human edit, audit log</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <p className="footnote secondary">
        All data is fictional.
        {started && (
          <>
            {' '}
            <button className="btn plain small link-inline" onClick={() => setConfirmReset(true)}>
              Start over
            </button>
          </>
        )}
      </p>
      <Sheet open={video} onClose={() => setVideo(false)} title="Concord in 30 seconds">
        <video controls autoPlay playsInline preload="metadata" poster={`${import.meta.env.BASE_URL}demo/poster.png`} style={{ width: '100%', borderRadius: 10, display: 'block', background: '#000' }}>
          <source src={`${import.meta.env.BASE_URL}demo/concord-demo.mp4`} type="video/mp4" />
          <track kind="captions" src={`${import.meta.env.BASE_URL}demo/captions.vtt`} srcLang="en" label="English" default />
        </video>
      </Sheet>
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
