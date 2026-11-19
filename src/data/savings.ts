/**
 * Illustrative resource model: manual AHP source selection vs the AI-assisted workflow.
 * These are planning assumptions, not measurements. Every input is editable in the app.
 */
import type { StepId } from '../state/types';

export interface SavingsInputs {
  vendors: number;
  paramsPerVendor: number;
  experts: number;
  criteria: number;
  inconsistentExperts: number;
  hourlyRate: number;
  schedulingLagDays: number;
}

export const DEFAULT_SAVINGS: SavingsInputs = {
  vendors: 4,
  paramsPerVendor: 40,
  experts: 8,
  criteria: 7,
  inconsistentExperts: 1,
  hourlyRate: 150,
  schedulingLagDays: 3,
};

export interface TaskEstimate {
  id: string;
  step: StepId;
  task: string;
  manualHours: number;
  aiHours: number;
  manualMeetings: number;
  aiMeetings: number;
  basis: string;
  unchanged?: boolean;
}

export function estimate(x: SavingsInputs): TaskEstimate[] {
  const pairs = (x.criteria * (x.criteria - 1)) / 2;
  const cells = x.vendors * x.paramsPerVendor;
  return [
    {
      id: 'hier',
      step: 'hierarchy',
      task: 'Turn requirements into a criteria hierarchy',
      manualHours: 12 + x.experts * 2,
      aiHours: 2 + x.experts * 1,
      manualMeetings: 2,
      aiMeetings: 1,
      basis: 'Manual: 12 h for the lead to draft, plus 2 h workshops × evaluators. AI: 2 h to review the draft, plus one shorter 1 h workshop.',
    },
    {
      id: 'extract',
      step: 'evidence',
      task: 'Extract and normalise datasheet values',
      manualHours: (cells * 6) / 60 * 1.3,
      aiHours: (cells * 1.5) / 60 + 0.1 * cells * (10 / 60),
      manualMeetings: 0,
      aiMeetings: 0,
      basis: `Manual: ${cells} values × 6 min, plus 30% for cross-checking. AI: 1.5 min to verify each value, plus 10 min for each flagged item (about 10%).`,
    },
    {
      id: 'judge',
      step: 'judgments',
      task: 'Expert pairwise judgments',
      manualHours: x.experts * pairs * 1.5 / 60 + x.experts * 0.5,
      aiHours: x.experts * pairs * 1.5 / 60 + x.experts * 0.5,
      manualMeetings: 0,
      aiMeetings: 0,
      basis: `${pairs} comparisons × 1.5 min per evaluator, plus 30 min of reading. Kept the same on purpose: this is the experts’ job.`,
      unchanged: true,
    },
    {
      id: 'consist',
      step: 'judgments',
      task: 'Find and resolve inconsistent judgments',
      manualHours: x.inconsistentExperts * 3,
      aiHours: x.inconsistentExperts * 0.25,
      manualMeetings: x.inconsistentExperts,
      aiMeetings: 0,
      basis: 'Manual: 2 h analyst diagnosis + 1 h follow-up with the evaluator, each. AI: the coach names the judgment and the evaluator fixes it in 15 min.',
    },
    {
      id: 'aggregate',
      step: 'group',
      task: 'Aggregate and prepare for the disagreement discussion',
      manualHours: 8,
      aiHours: 1.5,
      manualMeetings: 0,
      aiMeetings: 0,
      basis: 'Manual: spreadsheet work and briefing slides. AI: computed live; 1.5 h to review the drafted prompts.',
    },
    {
      id: 'consensus',
      step: 'group',
      task: 'Consensus meeting',
      manualHours: x.experts * 2,
      aiHours: x.experts * 1,
      manualMeetings: 1,
      aiMeetings: 1,
      basis: 'Same meeting either way. With the AI-prepared agenda it covers only the real disagreements, so we assume 1 h instead of 2 h.',
    },
    {
      id: 'sens',
      step: 'results',
      task: 'Sensitivity analysis and charts',
      manualHours: 6,
      aiHours: 1,
      manualMeetings: 0,
      aiMeetings: 0,
      basis: 'Manual: build what-if cases by hand. AI: crossover points computed instantly; 1 h to review.',
    },
    {
      id: 'memo',
      step: 'decision',
      task: 'Draft the decision document',
      manualHours: 32,
      aiHours: 8,
      manualMeetings: 1,
      aiMeetings: 1,
      basis: 'Manual: about 4 days of drafting. AI: 8 h for people to check, edit and own the draft. One review with the SSA either way.',
    },
  ];
}

export function totals(x: SavingsInputs) {
  const rows = estimate(x);
  const sum = (f: (r: TaskEstimate) => number) => rows.reduce((s, r) => s + f(r), 0);
  const manualHours = sum((r) => r.manualHours);
  const aiHours = sum((r) => r.aiHours);
  const manualMeetings = sum((r) => r.manualMeetings);
  const aiMeetings = sum((r) => r.aiMeetings);
  // Calendar: analyst work at 6 productive h/day, plus a scheduling lag for every meeting.
  const analystManual = sum((r) => (r.id === 'judge' || r.id === 'consensus' ? 0 : r.manualHours));
  const analystAi = sum((r) => (r.id === 'judge' || r.id === 'consensus' ? 0 : r.aiHours));
  const manualDays = analystManual / 6 + manualMeetings * x.schedulingLagDays + 2;
  const aiDays = analystAi / 6 + aiMeetings * x.schedulingLagDays + 2;
  return {
    rows,
    manualHours,
    aiHours,
    savedHours: manualHours - aiHours,
    savedPct: (manualHours - aiHours) / manualHours,
    manualCost: manualHours * x.hourlyRate,
    aiCost: aiHours * x.hourlyRate,
    manualMeetings,
    aiMeetings,
    manualDays,
    aiDays,
  };
}

export function savingFor(step: StepId, x: SavingsInputs = DEFAULT_SAVINGS): number {
  return estimate(x)
    .filter((r) => r.step === step && !r.unchanged)
    .reduce((s, r) => s + r.manualHours - r.aiHours, 0);
}
