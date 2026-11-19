import { CR_LIMIT } from '../ahp/engine';
import { ALTERNATIVES, QUANT_LEAVES, expertById, leafCriterion, type ExpertId } from '../data/scenario';
import type { Model } from './derive';
import { cellKey, type State, type StepId } from './types';

export const PROCESS: Array<{ id: StepId; label: string }> = [
  { id: 'setup', label: 'Set up' },
  { id: 'hierarchy', label: 'Criteria' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'judgments', label: 'Judgments' },
  { id: 'group', label: 'Group view' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'results', label: 'Results' },
  { id: 'decision', label: 'Decision' },
];

export function stepDone(state: State, model: Model): Partial<Record<StepId, boolean>> {
  return {
    setup: true,
    hierarchy: state.hierarchy === 'approved',
    evidence: model.evidenceVerified === model.evidenceTotal && state.screeningConfirmed,
    judgments: model.individuals.every((x) => x.cr <= CR_LIMIT),
    group: !!state.discussion.prompts && state.discussion.prompts.every((p, i) => state.discussion.done[`${p.criterion}-${i}`]),
    scoring: model.ready,
    results: !!state.sensitivityNote,
    decision: !!state.decision,
  };
}

export interface Action {
  who: ExpertId;
  what: string;
  step: StepId;
}

/** Outstanding actions, by owner — what management needs to chase. */
export function pendingActions(state: State, model: Model): Action[] {
  const out: Action[] = [];
  if (state.hierarchy === 'empty') out.push({ who: 'pm', what: 'Draft and approve criteria', step: 'hierarchy' });
  if (state.hierarchy === 'drafted') out.push({ who: 'pm', what: 'Approve the criteria hierarchy', step: 'hierarchy' });
  if (state.hierarchy === 'approved') {
    if (Object.keys(state.evidence).length === 0) out.push({ who: 'pm', what: 'Run evidence extraction', step: 'evidence' });
    else {
      const byOwner = new Map<ExpertId, number>();
      for (const l of QUANT_LEAVES)
        for (const a of ALTERNATIVES)
          if (state.evidence[cellKey(a.id, l.id)]?.status !== 'verified') {
            const o = leafCriterion(l.id).owner;
            byOwner.set(o, (byOwner.get(o) ?? 0) + 1);
          }
      byOwner.forEach((n, o) => out.push({ who: o, what: `Verify ${n} evidence value${n > 1 ? 's' : ''}`, step: 'evidence' }));
      if (byOwner.size === 0 && !state.screeningConfirmed) out.push({ who: 'pm', what: 'Confirm KPP screening', step: 'evidence' });
    }
  }
  for (const x of model.individuals) if (x.cr > CR_LIMIT) out.push({ who: x.expert.id, what: `Resolve inconsistency (CR ${x.cr.toFixed(2)})`, step: 'judgments' });
  if (model.ready && !state.decision) out.push({ who: 'ssa', what: 'Select and sign', step: 'decision' });
  return out;
}

export const roleOf = (id: ExpertId) => expertById(id).role;
