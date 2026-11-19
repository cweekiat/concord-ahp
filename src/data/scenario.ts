/**
 * Demo scenario: EO/IR sensor turret for a maritime patrol UAS.
 * Everything here is FICTIONAL — programme, vendors, products, people and numbers.
 */
import { judgmentsFromWeights, pairIndex } from '../ahp/engine';

export type AltId = 'A' | 'B' | 'C' | 'D';
export type ExpertId = 'pm' | 'sensor' | 'ram' | 'ils' | 'cost' | 'te' | 'cyber' | 'ops' | 'ssa';
export type CriterionId = 'PERF' | 'SUIT' | 'SWAP' | 'COST' | 'INTOP' | 'RISK' | 'CYBER';

export interface Alternative {
  id: AltId;
  name: string;
  vendor: string;
  summary: string;
  color: string;
}

export interface Expert {
  id: ExpertId;
  name: string;
  role: string;
  initials: string;
  /** Criteria this person owns: they verify its evidence and make its detailed judgments. */
  owns: CriterionId[];
  /** Whether this person weighs the top-level criteria. */
  judges: boolean;
  focus: string;
}

export interface Leaf {
  id: string;
  name: string;
  short: string;
  kind: 'quant' | 'qual';
  unit?: string;
  direction?: 'higher' | 'lower';
  threshold?: number;
  objective?: number;
  kpp?: boolean;
  reqRef: string;
  description: string;
}

export interface Criterion {
  id: CriterionId;
  name: string;
  short: string;
  description: string;
  owner: ExpertId;
  color: string;
  reqRef: string;
  leaves: Leaf[];
}

export const PROGRAMME = {
  name: 'Project TERN',
  goal: 'Select the EO/IR sensor turret for the TERN maritime patrol UAS that gives the best overall value across performance, suitability, affordability and risk.',
  context:
    'Milestone C production decision. Four proposals were received. The Source Selection Evaluation Board (SSEB) evaluates; the Source Selection Authority (SSA) decides.',
};

export const ALTERNATIVES: Alternative[] = [
  { id: 'A', name: 'AX-400', vendor: 'Alpha Optronics', summary: 'Long-range, fielded design. Best image quality, highest cost.', color: 'var(--blue)' },
  { id: 'B', name: 'Sentinel-9', vendor: 'Bravo Systems', summary: 'Balanced design with open (SOSA-aligned) interfaces.', color: 'var(--orange)' },
  { id: 'C', name: 'Kestrel EO', vendor: 'Charlie Photonics', summary: 'Light, cheap and reliable. Shorter range, newer design.', color: 'var(--teal)' },
  { id: 'D', name: 'DV-2', vendor: 'Delta Vision', summary: 'Good range, but heavy airframe integration.', color: 'var(--gray)' },
];

export const EXPERTS: Expert[] = [
  { id: 'pm', name: 'Jordan Lee', role: 'Program Manager', initials: 'JL', owns: ['RISK'], judges: true, focus: 'Cost, schedule and programme risk' },
  { id: 'sensor', name: 'Priya Natarajan', role: 'Sensor Performance Engineer', initials: 'PN', owns: ['PERF'], judges: true, focus: 'Detection, identification, stabilisation' },
  { id: 'ram', name: 'Sam Okafor', role: 'RAM Engineer', initials: 'SO', owns: ['SUIT'], judges: true, focus: 'Reliability, availability, maintainability' },
  { id: 'ils', name: 'Mei Lin Goh', role: 'ILS & Integration Lead', initials: 'MG', owns: ['SWAP'], judges: true, focus: 'Size, weight, power and supportability' },
  { id: 'cost', name: 'Daniel Ruiz', role: 'Cost Analyst', initials: 'DR', owns: ['COST'], judges: true, focus: 'Life-cycle cost estimate' },
  { id: 'te', name: 'Aisha Rahman', role: 'Test & Evaluation Lead', initials: 'AR', owns: ['INTOP'], judges: true, focus: 'Interoperability and test evidence' },
  { id: 'cyber', name: 'Tomás Weber', role: 'Cybersecurity Lead', initials: 'TW', owns: ['CYBER'], judges: true, focus: 'RMF, supply chain, cyber resilience' },
  { id: 'ops', name: 'Kai Mendoza', role: 'Operator Representative', initials: 'KM', owns: [], judges: true, focus: 'How crews will actually fly it' },
  { id: 'ssa', name: 'Dr. Helen Park', role: 'Source Selection Authority', initials: 'HP', owns: [], judges: false, focus: 'Makes and signs the decision' },
];

export const CRITERIA: Criterion[] = [
  {
    id: 'PERF',
    name: 'Mission performance',
    short: 'Performance',
    description: 'How well the sensor finds and identifies surface targets at sea.',
    owner: 'sensor',
    color: 'var(--blue)',
    reqRef: 'CDD 3.1, 3.3, 3.4',
    leaves: [
      { id: 'det', name: 'Detection range, 30 m vessel', short: 'Detection', kind: 'quant', unit: 'km', direction: 'higher', threshold: 20, objective: 35, kpp: true, reqRef: 'CDD 3.1 (KPP-1)', description: 'Sea State 3, 90% probability of detection (Johnson criteria).' },
      { id: 'idr', name: 'Identification range, 7 m craft (MWIR)', short: 'Identification', kind: 'quant', unit: 'km', direction: 'higher', threshold: 5, objective: 10, reqRef: 'CDD 3.3 (KSA-1)', description: 'Identification per Johnson criteria using the MWIR channel.' },
      { id: 'stab', name: 'Line-of-sight stabilisation', short: 'Stabilisation', kind: 'quant', unit: 'µrad RMS', direction: 'lower', threshold: 25, objective: 10, reqRef: 'CDD 3.4 (KSA-2)', description: 'Residual jitter in the reference vibration profile.' },
    ],
  },
  {
    id: 'SUIT',
    name: 'Reliability & maintainability',
    short: 'Suitability',
    description: 'How often it fails and how fast the maintainers can fix it.',
    owner: 'ram',
    color: 'var(--green)',
    reqRef: 'CDD 4.1, 4.2',
    leaves: [
      { id: 'mtbf', name: 'Mean time between failures (demonstrated)', short: 'MTBF', kind: 'quant', unit: 'h', direction: 'higher', threshold: 1500, objective: 4000, reqRef: 'CDD 4.1', description: 'Demonstrated in test or field data, not predicted.' },
      { id: 'mttr', name: 'Mean time to repair (O-level)', short: 'MTTR', kind: 'quant', unit: 'min', direction: 'lower', threshold: 60, objective: 20, reqRef: 'CDD 4.2', description: 'Organisational-level remove-and-replace of line-replaceable units.' },
    ],
  },
  {
    id: 'SWAP',
    name: 'Size, weight & power',
    short: 'SWaP',
    description: 'What it costs the airframe to carry it.',
    owner: 'ils',
    color: 'var(--teal)',
    reqRef: 'CDD 3.2',
    leaves: [
      { id: 'wt', name: 'Turret weight', short: 'Weight', kind: 'quant', unit: 'kg', direction: 'lower', threshold: 45, objective: 30, kpp: true, reqRef: 'CDD 3.2 (KPP-2)', description: 'Installed weight including the mount.' },
      { id: 'pwr', name: 'Peak power draw', short: 'Power', kind: 'quant', unit: 'W', direction: 'lower', threshold: 400, objective: 250, kpp: true, reqRef: 'CDD 3.2 (KPP-2)', description: 'Peak power with heaters on.' },
    ],
  },
  {
    id: 'COST',
    name: 'Life-cycle cost',
    short: 'Cost',
    description: 'Cost to buy, operate and support each unit for 20 years.',
    owner: 'cost',
    color: 'var(--orange)',
    reqRef: 'CDD 5.1',
    leaves: [
      { id: 'lcc', name: '20-year life-cycle cost per unit', short: 'LCC', kind: 'quant', unit: '$M', direction: 'lower', threshold: 9, objective: 5, reqRef: 'CDD 5.1', description: 'Government cost estimate: buy, spares, sustainment and upgrades.' },
    ],
  },
  {
    id: 'INTOP',
    name: 'Integration & interoperability',
    short: 'Interoperability',
    description: 'How easily it plugs into the aircraft and the wider force.',
    owner: 'te',
    color: 'var(--indigo)',
    reqRef: 'CDD 6.1',
    leaves: [{ id: 'mosa', name: 'MOSA / STANAG 4609 conformance', short: 'Open interfaces', kind: 'qual', reqRef: 'CDD 6.1', description: 'Judged from interface documents and the integration lab demo.' }],
  },
  {
    id: 'RISK',
    name: 'Programme risk',
    short: 'Risk',
    description: 'How likely it is to arrive on time and as promised.',
    owner: 'pm',
    color: 'var(--pink)',
    reqRef: 'CDD 7.1',
    leaves: [{ id: 'mat', name: 'Technology & schedule maturity', short: 'Maturity', kind: 'qual', reqRef: 'CDD 7.1', description: 'TRL/MRL evidence, production readiness and delivery plan.' }],
  },
  {
    id: 'CYBER',
    name: 'Cybersecurity',
    short: 'Cyber',
    description: 'How resilient it is and how ready it is for an Authority to Operate.',
    owner: 'cyber',
    color: 'var(--purple)',
    reqRef: 'CDD 6.2',
    leaves: [{ id: 'rmf', name: 'Cyber resilience & RMF readiness', short: 'Cyber resilience', kind: 'qual', reqRef: 'CDD 6.2', description: 'Security controls package, SBOM, secure boot, update path.' }],
  },
];

export const LEAVES: Leaf[] = CRITERIA.flatMap((c) => c.leaves);
export const QUANT_LEAVES = LEAVES.filter((l) => l.kind === 'quant');
export const QUAL_LEAVES = LEAVES.filter((l) => l.kind === 'qual');
export const JUDGES = EXPERTS.filter((e) => e.judges);

export const leafCriterion = (leafId: string) => CRITERIA.find((c) => c.leaves.some((l) => l.id === leafId))!;
export const expertById = (id: ExpertId) => EXPERTS.find((e) => e.id === id)!;
export const altById = (id: AltId) => ALTERNATIVES.find((a) => a.id === id)!;

/** Verified values (what the datasheets actually support once a human has checked them). */
export const TRUE_VALUES: Record<AltId, Record<string, number>> = {
  A: { det: 38, idr: 11, stab: 8, mtbf: 2200, mttr: 45, wt: 41, pwr: 380, lcc: 8.6 },
  B: { det: 32, idr: 9.5, stab: 12, mtbf: 3100, mttr: 30, wt: 36, pwr: 300, lcc: 6.9 },
  C: { det: 26, idr: 7, stab: 18, mtbf: 3800, mttr: 25, wt: 31, pwr: 260, lcc: 5.4 },
  D: { det: 34, idr: 8.5, stab: 14, mtbf: 2600, mttr: 40, wt: 52, pwr: 420, lcc: 7.4 },
};

/* ---------- Pre-collected judgments (each expert submitted these independently) ---------- */

// Order: PERF, SUIT, SWAP, COST, INTOP, RISK, CYBER
const EXPERT_PRIORITIES: Record<Exclude<ExpertId, 'ssa'>, number[]> = {
  pm: [0.22, 0.16, 0.08, 0.22, 0.1, 0.14, 0.08],
  sensor: [0.4, 0.1, 0.1, 0.12, 0.1, 0.1, 0.08],
  ram: [0.12, 0.38, 0.08, 0.16, 0.08, 0.1, 0.08],
  ils: [0.14, 0.28, 0.1, 0.2, 0.1, 0.1, 0.08],
  cost: [0.16, 0.14, 0.06, 0.36, 0.08, 0.12, 0.08],
  te: [0.22, 0.18, 0.08, 0.14, 0.12, 0.16, 0.1],
  cyber: [0.18, 0.12, 0.06, 0.12, 0.14, 0.12, 0.26],
  ops: [0.3, 0.2, 0.12, 0.1, 0.1, 0.1, 0.08],
};

/** Index of a pair (i<j) inside the 21 upper-triangle judgments for 7 criteria. */
export function pairPos(n: number, i: number, j: number): number {
  return pairIndex(n).findIndex(([a, b]) => a === i && b === j);
}

export function initialCriteriaJudgments(): Record<ExpertId, number[]> {
  const out = {} as Record<ExpertId, number[]>;
  for (const [id, w] of Object.entries(EXPERT_PRIORITIES)) out[id as ExpertId] = judgmentsFromWeights(w);
  // The operator rep slipped when entering Performance vs Cost: "Cost is strongly more
  // important", which contradicts every other judgment they made. The coach should catch it.
  out.ops[pairPos(7, 0, 3)] = 1 / 5;
  return out;
}

/** Owner judgments over sub-criteria (only criteria with 2+ leaves). */
export function initialAreaJudgments(): Partial<Record<CriterionId, number[]>> {
  return {
    PERF: judgmentsFromWeights([0.3, 0.5, 0.2]),
    SUIT: judgmentsFromWeights([0.6, 0.4]),
    SWAP: judgmentsFromWeights([0.65, 0.35]),
  };
}

/** Owner judgments comparing the four proposals on the qualitative criteria (order A, B, C, D). */
export function initialQualJudgments(): Record<string, number[]> {
  return {
    mosa: judgmentsFromWeights([0.25, 0.45, 0.18, 0.12]),
    mat: judgmentsFromWeights([0.42, 0.3, 0.14, 0.14]),
    rmf: judgmentsFromWeights([0.3, 0.38, 0.17, 0.15]),
  };
}
