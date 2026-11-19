/**
 * Demo-mode AI. Hierarchy and extraction responses were recorded for this fictional scenario.
 * The coach, discussion, sensitivity and memo responses are templates filled from the live
 * numbers the AHP engine computed — so they always match what's on screen.
 * The UI always labels these as scripted demo responses.
 */
import type { AltId, CriterionId, ExpertId } from '../data/scenario';
import type { DiscussionPrompt, HierarchyDraft, SensitivityNote } from '../state/types';

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

export const DEMO_HIERARCHY: HierarchyDraft = {
  criteria: [
    {
      name: 'Mission performance',
      rationale: 'KPP-1 and two KSAs describe how well the sensor finds and identifies targets. Group them so performance is weighed once.',
      reqRef: 'CDD 3.1, 3.3, 3.4',
      subcriteria: [
        { name: 'Detection range, 30 m vessel', measure: 'km, higher is better', threshold: '20 km', objective: '35 km', reqRef: 'CDD 3.1' },
        { name: 'Identification range, 7 m craft (MWIR)', measure: 'km, higher is better', threshold: '5 km', objective: '10 km', reqRef: 'CDD 3.3' },
        { name: 'Line-of-sight stabilisation', measure: 'µrad RMS, lower is better', threshold: '25', objective: '10', reqRef: 'CDD 3.4' },
      ],
    },
    {
      name: 'Reliability & maintainability',
      rationale: 'CDD 4.x. Keep reliability and maintainability as separate sub-criteria: they drive different support costs.',
      reqRef: 'CDD 4.1, 4.2',
      subcriteria: [
        { name: 'Demonstrated MTBF', measure: 'hours, higher is better', threshold: '1,500 h', objective: '4,000 h', reqRef: 'CDD 4.1' },
        { name: 'O-level MTTR', measure: 'minutes, lower is better', threshold: '60 min', objective: '20 min', reqRef: 'CDD 4.2' },
      ],
    },
    {
      name: 'Size, weight & power',
      rationale: 'KPP-2. Also a hard screen: a proposal over the threshold cannot be integrated.',
      reqRef: 'CDD 3.2',
      subcriteria: [
        { name: 'Turret weight', measure: 'kg, lower is better', threshold: '45 kg', objective: '30 kg', reqRef: 'CDD 3.2' },
        { name: 'Peak power draw', measure: 'W, lower is better', threshold: '400 W', objective: '250 W', reqRef: 'CDD 3.2' },
      ],
    },
    {
      name: 'Life-cycle cost',
      rationale: 'CDD 5.1 sets an affordability target. Use the government cost estimate, not vendor prices.',
      reqRef: 'CDD 5.1',
      subcriteria: [{ name: '20-year life-cycle cost per unit', measure: '$M, lower is better', threshold: '$9.0M', objective: '$5.0M', reqRef: 'CDD 5.1' }],
    },
    {
      name: 'Integration & interoperability',
      rationale: 'CDD 6.1 is a "comply / preferred" requirement with no numeric scale. The T&E Lead should compare proposals directly.',
      reqRef: 'CDD 6.1',
      subcriteria: [{ name: 'MOSA / STANAG 4609 conformance', measure: 'judged pairwise by the owner', reqRef: 'CDD 6.1' }],
    },
    {
      name: 'Programme risk',
      rationale: 'CDD 7.1 sets a TRL floor and a delivery window. Maturity beyond the floor still differs between proposals.',
      reqRef: 'CDD 7.1',
      subcriteria: [{ name: 'Technology & schedule maturity', measure: 'judged pairwise by the owner', reqRef: 'CDD 7.1' }],
    },
    {
      name: 'Cybersecurity',
      rationale: 'CDD 6.2. Needed for an Authority to Operate. Judged from each proposal’s security package.',
      reqRef: 'CDD 6.2',
      subcriteria: [{ name: 'Cyber resilience & RMF readiness', measure: 'judged pairwise by the owner', reqRef: 'CDD 6.2' }],
    },
  ],
  screeningRules: [
    'KPP-1: drop any proposal that detects a 30 m vessel at less than 20 km.',
    'KPP-2: drop any proposal heavier than 45 kg or drawing more than 400 W.',
  ],
  gaps: [
    'Interoperability, programme risk and cyber have no numeric thresholds. Their owners should compare proposals pairwise instead of using a value function.',
    'Operational availability (Ao) follows from MTBF and MTTR. Don’t add it as its own criterion, or reliability gets counted twice.',
    'No requirement covers operator training burden. Ask the Operator Representative whether it should be added before judging starts.',
  ],
};

export interface ExtractionRow {
  alt: AltId;
  leaf: string;
  value: number;
  unit: string;
  quote: string;
  source: string;
  confidence: number;
  flag?: string;
  flagKind?: 'ambiguity' | 'unit' | 'threshold';
}

export const DEMO_EXTRACTION: ExtractionRow[] = [
  { alt: 'A', leaf: 'det', value: 38, unit: 'km', quote: 'Detection, 30 m vessel: 38 km.', source: 'AX-400 Rev C, p.4, Table 2', confidence: 0.97 },
  { alt: 'A', leaf: 'idr', value: 11, unit: 'km', quote: 'Identification, 7 m craft (MWIR): 11 km.', source: 'AX-400 Rev C, p.4, Table 2', confidence: 0.96 },
  { alt: 'A', leaf: 'stab', value: 8, unit: 'µrad RMS', quote: 'Stabilisation: 8 µrad RMS (reference profile).', source: 'AX-400 Rev C, p.4', confidence: 0.95 },
  { alt: 'A', leaf: 'mtbf', value: 2200, unit: 'h', quote: 'demonstrated MTBF 2,200 h (fleet data, 2023–2025)', source: 'AX-400 Rev C, p.7', confidence: 0.95 },
  { alt: 'A', leaf: 'mttr', value: 45, unit: 'min', quote: 'MTTR 45 min O-level.', source: 'AX-400 Rev C, p.7', confidence: 0.95 },
  { alt: 'A', leaf: 'wt', value: 41, unit: 'kg', quote: '41 kg installed incl. mount.', source: 'AX-400 Rev C, p.6', confidence: 0.97 },
  { alt: 'A', leaf: 'pwr', value: 380, unit: 'W', quote: 'Peak power 380 W (heaters on).', source: 'AX-400 Rev C, p.6', confidence: 0.96 },
  { alt: 'A', leaf: 'lcc', value: 8.6, unit: '$M', quote: 'AX-400: $8.6M per unit, 20-yr, FY26$.', source: 'Government cost estimate v1.3, Table 4', confidence: 0.99 },

  { alt: 'B', leaf: 'det', value: 32, unit: 'km', quote: 'Detection, 30 m vessel, SS3: 32 km.', source: 'Sentinel-9 TD v2.1, §3', confidence: 0.96 },
  { alt: 'B', leaf: 'idr', value: 9.5, unit: 'km', quote: 'Identification, 7 m craft, MWIR: 9.5 km.', source: 'Sentinel-9 TD v2.1, §3', confidence: 0.96 },
  { alt: 'B', leaf: 'stab', value: 12, unit: 'µrad RMS', quote: 'LOS stabilisation: 12 µrad RMS.', source: 'Sentinel-9 TD v2.1, §3', confidence: 0.95 },
  {
    alt: 'B',
    leaf: 'mtbf',
    value: 3100,
    unit: 'h',
    quote: 'predicted MTBF 5,200 h (MIL-HDBK-217F). Demonstrated MTBF 3,100 h (qualification test, 2025).',
    source: 'Sentinel-9 TD v2.1, §5',
    confidence: 0.78,
    flagKind: 'ambiguity',
    flag: 'Two MTBF figures are given: predicted 5,200 h and demonstrated 3,100 h. CDD 4.1 does not accept predicted values, so I used 3,100 h. Please confirm.',
  },
  { alt: 'B', leaf: 'mttr', value: 30, unit: 'min', quote: 'MTTR 30 min, tool-less LRU swap.', source: 'Sentinel-9 TD v2.1, §5', confidence: 0.95 },
  { alt: 'B', leaf: 'wt', value: 36, unit: 'kg', quote: 'Mass 36 kg installed.', source: 'Sentinel-9 TD v2.1, §4', confidence: 0.96 },
  { alt: 'B', leaf: 'pwr', value: 300, unit: 'W', quote: 'Power 300 W peak.', source: 'Sentinel-9 TD v2.1, §4', confidence: 0.96 },
  { alt: 'B', leaf: 'lcc', value: 6.9, unit: '$M', quote: 'Sentinel-9: $6.9M per unit, 20-yr, FY26$.', source: 'Government cost estimate v1.3, Table 4', confidence: 0.99 },

  { alt: 'C', leaf: 'det', value: 26, unit: 'km', quote: 'detects 30 m vessels at 26 km', source: 'Kestrel EO brochure', confidence: 0.86, flagKind: 'ambiguity', flag: 'The brochure does not state sea state or probability of detection. Ask the vendor to confirm the range is quoted at SS3, Pd 0.9.' },
  { alt: 'C', leaf: 'idr', value: 7, unit: 'km', quote: 'identifies 7 m craft at 7 km (MWIR)', source: 'Kestrel EO brochure', confidence: 0.9 },
  { alt: 'C', leaf: 'stab', value: 18, unit: 'µrad RMS', quote: 'Stabilisation 18 µrad RMS.', source: 'Kestrel EO brochure', confidence: 0.93 },
  {
    alt: 'C',
    leaf: 'mtbf',
    value: 3800,
    unit: 'h',
    quote: 'demonstrated MTBF 3,800 h (accelerated life test)',
    source: 'Kestrel EO brochure',
    confidence: 0.82,
    flagKind: 'ambiguity',
    flag: 'This comes from an accelerated life test, not field data. The RAM Engineer should decide whether it counts as “demonstrated” under CDD 4.1.',
  },
  { alt: 'C', leaf: 'mttr', value: 25, unit: 'min', quote: 'MTTR 25 min.', source: 'Kestrel EO brochure', confidence: 0.93 },
  {
    alt: 'C',
    leaf: 'wt',
    value: 31,
    unit: 'kg',
    quote: 'Weight: 68.3 lb installed.',
    source: 'Kestrel EO brochure',
    confidence: 0.84,
    flagKind: 'unit',
    flag: 'Converted 68.3 lb to 31.0 kg (× 0.4536).',
  },
  { alt: 'C', leaf: 'pwr', value: 260, unit: 'W', quote: 'Power: 260 W peak.', source: 'Kestrel EO brochure', confidence: 0.93 },
  { alt: 'C', leaf: 'lcc', value: 5.4, unit: '$M', quote: 'Kestrel EO: $5.4M per unit, 20-yr, FY26$.', source: 'Government cost estimate v1.3, Table 4', confidence: 0.99 },

  { alt: 'D', leaf: 'det', value: 34, unit: 'km', quote: 'Detection of 30 m vessel at 34 km', source: 'DV-2 Proposal Vol II, 2.3', confidence: 0.95 },
  { alt: 'D', leaf: 'idr', value: 8.5, unit: 'km', quote: 'identification of 7 m craft at 8.5 km', source: 'DV-2 Proposal Vol II, 2.3', confidence: 0.94 },
  { alt: 'D', leaf: 'stab', value: 14, unit: 'µrad RMS', quote: 'Stabilisation 14 µrad RMS.', source: 'DV-2 Proposal Vol II, 2.4', confidence: 0.95 },
  { alt: 'D', leaf: 'mtbf', value: 2600, unit: 'h', quote: 'Demonstrated MTBF 2,600 h', source: 'DV-2 Proposal Vol II, 2.8', confidence: 0.94 },
  { alt: 'D', leaf: 'mttr', value: 40, unit: 'min', quote: 'MTTR 40 min.', source: 'DV-2 Proposal Vol II, 2.8', confidence: 0.94 },
  { alt: 'D', leaf: 'wt', value: 52, unit: 'kg', quote: 'Installed weight 52 kg', source: 'DV-2 Proposal Vol II, 2.6', confidence: 0.96, flagKind: 'threshold', flag: '52 kg is over the 45 kg KPP-2 threshold.' },
  { alt: 'D', leaf: 'pwr', value: 420, unit: 'W', quote: 'peak power 420 W.', source: 'DV-2 Proposal Vol II, 2.6', confidence: 0.96, flagKind: 'threshold', flag: '420 W is over the 400 W KPP-2 threshold.' },
  { alt: 'D', leaf: 'lcc', value: 7.4, unit: '$M', quote: 'DV-2: $7.4M per unit, 20-yr, FY26$.', source: 'Government cost estimate v1.3, Table 4', confidence: 0.99 },
];

/* ---------------- Facts passed to the AI (demo templates and live prompts alike) ---------------- */

export interface CoachFacts {
  expert: string;
  role: string;
  left: string;
  right: string;
  current: string;
  suggested: string;
  minimal: string | null;
  crBefore: number;
  crAfter: number;
  crAfterMinimal: number | null;
  supporting: string[];
}

export interface CoachNote {
  explanation: string;
  question: string;
}

export function demoCoach(f: CoachFacts): CoachNote {
  return {
    explanation:
      `Your matrix has a consistency ratio of ${f.crBefore.toFixed(2)}, above the 0.10 limit. The judgment doing most of the damage is ${f.left} vs ${f.right}, which you entered as ${f.current}. ` +
      `Your other answers point the other way: ${f.supporting.join('; ')}. ` +
      `If you meant ${f.suggested}, CR drops to ${f.crAfter.toFixed(2)}.` +
      (f.minimal && f.minimal !== f.suggested ? ` The smallest change that passes is ${f.minimal} (CR ${f.crAfterMinimal?.toFixed(2)}).` : ''),
    question: `Did you mean that ${f.right} matters more than ${f.left}, or was the slider dragged the wrong way? Either answer is valid. If it’s intentional, keep it and add a note explaining why.`,
  };
}

export interface DiscussionFacts {
  items: Array<{ criterion: CriterionId; name: string; cv: number; low: { id: ExpertId; role: string; w: number }; high: { id: ExpertId; role: string; w: number }; groupWeight: number }>;
}

export function demoDiscussion(f: DiscussionFacts): DiscussionPrompt[] {
  const q: Record<string, (x: DiscussionFacts['items'][number]) => string> = {
    SUIT: (x) => `${x.high.role}: what failure rate would make the fleet unworkable at sea? ${x.low.role}: would a turret that is down twice as often still meet the mission?`,
    PERF: (x) => `${x.high.role}: how often do we need identification beyond 7 km in the threat scenarios? ${x.low.role}: what does losing that range cost in sorties or risk?`,
    COST: (x) => `${x.high.role}: how close are we to the affordability cap across the whole fleet? ${x.low.role}: what extra performance would justify paying $1–2M more per unit?`,
    CYBER: (x) => `${x.high.role}: which findings could block the Authority to Operate? ${x.low.role}: are those risks already covered by platform-level controls?`,
    RISK: (x) => `${x.high.role}: what slips if a TRL 7 design needs another test cycle? ${x.low.role}: is that schedule risk already priced into the cost estimate?`,
    INTOP: (x) => `${x.high.role}: what does a proprietary interface cost us at the next upgrade? ${x.low.role}: is an external encoder an acceptable workaround?`,
    SWAP: (x) => `${x.high.role}: how much endurance does each extra kilogram cost? ${x.low.role}: is there margin on the airframe we are not counting?`,
  };
  return f.items.slice(0, 3).map((x) => ({
    criterion: x.criterion,
    addressedTo: [x.high.id, x.low.id],
    question: q[x.criterion](x),
    why: `Weights for ${x.name} range from ${pct(x.low.w)} (${x.low.role}) to ${pct(x.high.w)} (${x.high.role}). The group uses ${pct(x.groupWeight)}. This gap usually means people are picturing different scenarios, not that one of them is wrong.`,
  }));
}

export interface SensitivityFacts {
  leader: string;
  runnerUp: string;
  margin: number;
  stable: string[];
  reversals: Array<{ criterion: string; current: number; at: number; newLeader: string }>;
}

export function demoSensitivity(f: SensitivityFacts): SensitivityNote {
  const closest = [...f.reversals].sort((a, b) => Math.abs(a.at - a.current) - Math.abs(b.at - b.current))[0];
  return {
    summary: closest
      ? `${f.leader} leads ${f.runnerUp} by ${(f.margin * 100).toFixed(1)} points. The ranking is most sensitive to ${closest.criterion}: if its weight moves from ${pct(closest.current)} to ${pct(closest.at)}, ${closest.newLeader} takes first place.`
      : `${f.leader} leads ${f.runnerUp} by ${(f.margin * 100).toFixed(1)} points, and no single change in criterion weight changes who comes first.`,
    bullets: [
      ...f.reversals.map((r) => `${r.criterion}: ${r.newLeader} would rank first if this weight rose to ${pct(r.at)} (now ${pct(r.current)}).`),
      f.stable.length ? `The leader does not change for any weight of: ${f.stable.join(', ')}.` : '',
      'These are one-at-a-time checks. The SSA should still ask whether any plausible combination of changes would flip the result.',
    ].filter(Boolean),
  };
}

export interface MemoFacts {
  programme: string;
  goal: string;
  date: string;
  alternatives: string[];
  screenedOut: Array<{ name: string; reasons: string[] }>;
  team: string[];
  inconsistentNotes: string[];
  groupCR: number;
  weights: Array<{ name: string; w: number }>;
  ranking: Array<{ name: string; score: number }>;
  discriminators: string[];
  sensitivity: string | null;
  disagreements: string[];
  evidenceNotes: string[];
}

export function demoMemo(f: MemoFacts): string {
  const [first, second] = f.ranking;
  return `# Source Selection Decision Document — DRAFT
**${f.programme}** · Prepared ${f.date} · *AI-drafted for SSA review. Every figure comes from the evaluation record.*

## 1. Purpose
${f.goal}

## 2. Proposals and screening
Proposals received: ${f.alternatives.join(', ')}.
${f.screenedOut.length ? f.screenedOut.map((s) => `- **${s.name}** was screened out: ${s.reasons.join('; ')}.`).join('\n') : '- All proposals met the KPP thresholds.'}

## 3. How the evaluation was done
Analytic Hierarchy Process with ${f.team.length} evaluators (${f.team.join(', ')}). Each evaluator weighted the criteria independently. Individual judgments were combined with an element-wise geometric mean (AIJ). The consistency ratio of the combined matrix is ${f.groupCR.toFixed(3)}.
${f.inconsistentNotes.length ? f.inconsistentNotes.map((n) => `- ${n}`).join('\n') : '- Every individual matrix is within the 0.10 consistency limit.'}

| Criterion | Group weight |
|---|---|
${f.weights.map((w) => `| ${w.name} | ${pct(w.w, 1)} |`).join('\n')}

## 4. Results
| Rank | Proposal | Overall score |
|---|---|---|
${f.ranking.map((r, i) => `| ${i + 1} | ${r.name} | ${r.score.toFixed(3)} |`).join('\n')}

${first && second ? `${first.name} ranks first, ${((first.score - second.score) * 100).toFixed(1)} points ahead of ${second.name}.` : ''}

## 5. What separates the proposals
${f.discriminators.map((d) => `- ${d}`).join('\n')}

## 6. Sensitivity
${f.sensitivity ?? 'Sensitivity analysis not yet reviewed.'}

## 7. Evidence notes
${f.evidenceNotes.length ? f.evidenceNotes.map((n) => `- ${n}`).join('\n') : '- No evidence items were corrected or flagged.'}

## 8. Recorded disagreement
${f.disagreements.length ? f.disagreements.map((d) => `- ${d}`).join('\n') : '- None recorded.'}

## 9. Decision
*To be completed by the Source Selection Authority. The AHP ranking informs this decision but does not make it. The SSA may select a different proposal if the rationale is documented.*
`;
}
