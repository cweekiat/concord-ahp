/**
 * Every AI task in the app. Each has a demo implementation and a live prompt.
 * Live mode calls the Claude API straight from the browser using the visitor's own key
 * (held in memory only). The AI's output is always a *suggestion* a named human accepts or rejects.
 */
import { DATASHEETS, REQUIREMENTS_DOC } from '../data/docs';
import { QUANT_LEAVES } from '../data/scenario';
import type { DiscussionPrompt, HierarchyDraft, SensitivityNote } from '../state/types';
import {
  DEMO_EXTRACTION,
  DEMO_HIERARCHY,
  demoCoach,
  demoDiscussion,
  demoMemo,
  demoSensitivity,
  type CoachFacts,
  type CoachNote,
  type DiscussionFacts,
  type ExtractionRow,
  type MemoFacts,
  type SensitivityFacts,
} from './demo';

import { callLLM, type AIConfig } from './providers';

export interface AIOptions extends AIConfig {
  apiKey: string;
}

export interface AIResult<T> {
  data: T;
  source: 'demo' | 'live';
  model: string;
  ms: number;
}

const GUARDRAIL = `You support a DoD-style source selection team using the Analytic Hierarchy Process.
Rules you must follow:
- You assist; you never decide. Never recommend which proposal to select, never cast a judgment on behalf of an evaluator.
- Only use facts given to you. Every number you state must appear in the input. If something is missing, say so.
- Cite the source (document, section/page) for every extracted value.
- Write in plain, direct English for busy engineers. Short sentences.`;

interface TaskDef<I, O> {
  label: string;
  system: string;
  user: (input: I) => string;
  schema: Record<string, unknown>;
  demo: (input: I) => O;
  fromLive?: (raw: any, input: I) => O;
}

const str = { type: 'string' };

/** Coerce whatever a model returned into plain text (small models sometimes nest objects). */
export function toText(x: unknown): string {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (Array.isArray(x)) return x.map(toText).filter(Boolean).join(' ');
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>;
    for (const k of ['text', 'content', 'value', 'bullet', 'summary', 'markdown']) if (typeof o[k] === 'string') return o[k] as string;
    const vals = Object.values(o);
    if (vals.length === 1) return toText(vals[0]) || Object.keys(o)[0];
  }
  if (typeof x === 'object') return Object.entries(x as Record<string, unknown>).map(([k, v]) => (v == null || v === '' ? k : `${k}: ${toText(v)}`)).join('; ');
  return String(x);
}
const texts = (x: unknown): string[] => (Array.isArray(x) ? x : x == null ? [] : [x]).map(toText).filter(Boolean);
const num = (x: unknown): number => (typeof x === 'number' ? x : parseFloat(String(x).replace(/,/g, '')));

const hierarchy: TaskDef<void, HierarchyDraft> = {
  label: 'Draft criteria hierarchy',
  system: GUARDRAIL + '\nTask: draft an AHP criteria hierarchy from a capability requirements document.',
  user: () =>
    `Requirements document:\n"""\n${REQUIREMENTS_DOC}\n"""\nDraft 5–8 top-level criteria, each with sub-criteria, measures and threshold/objective values where the document gives them. Each criterion needs a requirement reference. List hard screening rules (KPP thresholds) separately. List gaps or double-counting risks the team should resolve. Criteria must be independent enough for AHP.`,
  schema: {
    type: 'object',
    properties: {
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: str,
            rationale: str,
            reqRef: str,
            subcriteria: {
              type: 'array',
              items: { type: 'object', properties: { name: str, measure: str, threshold: str, objective: str, reqRef: str }, required: ['name', 'measure', 'reqRef'] },
            },
          },
          required: ['name', 'rationale', 'reqRef', 'subcriteria'],
        },
      },
      screeningRules: { type: 'array', items: str },
      gaps: { type: 'array', items: str },
    },
    required: ['criteria', 'screeningRules', 'gaps'],
  },
  demo: () => DEMO_HIERARCHY,
  fromLive: (raw) => ({
    criteria: (Array.isArray(raw?.criteria) ? raw.criteria : []).map((c: any) => ({
      name: toText(c?.name),
      rationale: toText(c?.rationale),
      reqRef: toText(c?.reqRef),
      subcriteria: (Array.isArray(c?.subcriteria) ? c.subcriteria : []).map((sc: any) => ({ name: toText(sc?.name), measure: toText(sc?.measure), threshold: sc?.threshold ? toText(sc.threshold) : undefined, objective: sc?.objective ? toText(sc.objective) : undefined, reqRef: toText(sc?.reqRef) })),
    })),
    screeningRules: texts(raw?.screeningRules),
    gaps: texts(raw?.gaps),
  }),
};

const evidence: TaskDef<void, ExtractionRow[]> = {
  label: 'Extract evidence from datasheets',
  system: GUARDRAIL + '\nTask: extract measured values from vendor documents into a normalised evidence table.',
  user: () => {
    const docs = Object.entries(DATASHEETS)
      .map(([id, d]) => `--- Proposal ${id}: ${d.title} ---\n${d.text}`)
      .join('\n\n');
    const leaves = QUANT_LEAVES.filter((l) => l.id !== 'lcc')
      .map((l) => `- ${l.id}: ${l.name} [${l.unit}] threshold ${l.threshold}, objective ${l.objective}`)
      .join('\n');
    return `Documents:\n${docs}\n\nFor each proposal (A, B, C, D) and each measure below, extract the value converted into the stated unit. Quote the exact source text. Give confidence 0–1. Add a flag (kind ambiguity | unit | threshold) when: several values compete, you converted units, conditions are missing, or the value breaks a threshold.\nMeasures:\n${leaves}`;
  },
  schema: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            alt: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            leaf: { type: 'string' },
            value: { type: 'number' },
            unit: str,
            quote: str,
            source: str,
            confidence: { type: 'number' },
            flag: str,
            flagKind: { type: 'string', enum: ['ambiguity', 'unit', 'threshold'] },
          },
          required: ['alt', 'leaf', 'value', 'unit', 'quote', 'source', 'confidence'],
        },
      },
    },
    required: ['rows'],
  },
  demo: () => DEMO_EXTRACTION,
  // Life-cycle cost comes from the government estimate, not datasheets: keep the recorded rows.
  fromLive: (raw) => {
    const ids = new Set(QUANT_LEAVES.map((l) => l.id));
    const rows: ExtractionRow[] = (Array.isArray(raw?.rows) ? raw.rows : [])
      .map((r: any) => ({
        alt: String(r?.alt).trim().toUpperCase(),
        leaf: String(r?.leaf).trim(),
        value: num(r?.value),
        unit: toText(r?.unit),
        quote: toText(r?.quote),
        source: toText(r?.source),
        confidence: Math.min(1, Math.max(0, num(r?.confidence) || 0)),
        flag: r?.flag ? toText(r.flag) : undefined,
        flagKind: ['ambiguity', 'unit', 'threshold'].includes(r?.flagKind) ? r.flagKind : r?.flag ? 'ambiguity' : undefined,
      }))
      .filter((r: ExtractionRow) => ['A', 'B', 'C', 'D'].includes(r.alt) && ids.has(r.leaf) && r.leaf !== 'lcc' && Number.isFinite(r.value));
    if (rows.length === 0) throw new Error('The model returned no usable evidence rows.');
    return [...rows, ...DEMO_EXTRACTION.filter((r) => r.leaf === 'lcc')];
  },
};

const coach: TaskDef<CoachFacts, CoachNote> = {
  label: 'Explain inconsistency',
  system: GUARDRAIL + '\nTask: help one evaluator understand why their pairwise judgments are inconsistent. The maths has already been done; explain it. Do not tell them what to choose.',
  user: (f) => `Facts (computed by the AHP engine):\n${JSON.stringify(f, null, 2)}\nWrite a 3–4 sentence explanation addressed to the evaluator, then one neutral question that asks what they meant.`,
  schema: { type: 'object', properties: { explanation: str, question: str }, required: ['explanation', 'question'] },
  demo: demoCoach,
  fromLive: (raw) => ({ explanation: toText(raw?.explanation), question: toText(raw?.question) }),
};

const discussion: TaskDef<DiscussionFacts, DiscussionPrompt[]> = {
  label: 'Draft discussion prompts',
  system: GUARDRAIL + '\nTask: help a facilitator run a short consensus discussion where evaluators disagree on weights. Ask questions that bring out the assumptions behind each view. Do not take sides.',
  user: (f) => `Disagreement data (computed):\n${JSON.stringify(f, null, 2)}\nWrite one prompt for each of the top 3 items. Address each to the two evaluator ids at the extremes.`,
  schema: {
    type: 'object',
    properties: {
      prompts: {
        type: 'array',
        items: {
          type: 'object',
          properties: { criterion: str, addressedTo: { type: 'array', items: str }, question: str, why: str },
          required: ['criterion', 'addressedTo', 'question', 'why'],
        },
      },
    },
    required: ['prompts'],
  },
  demo: demoDiscussion,
  fromLive: (raw) =>
    (Array.isArray(raw?.prompts) ? raw.prompts : []).map((p: any) => ({
      criterion: toText(p?.criterion).toUpperCase(),
      addressedTo: texts(p?.addressedTo),
      question: toText(p?.question),
      why: toText(p?.why),
    })),
};

const sensitivity: TaskDef<SensitivityFacts, SensitivityNote> = {
  label: 'Explain sensitivity',
  system: GUARDRAIL + '\nTask: explain one-at-a-time sensitivity results to a decision-maker in plain language.',
  user: (f) => {
    const p = (x: number) => `${(x * 100).toFixed(0)}%`;
    const lines = f.reversals.map((r) => `- ${r.criterion}: weight is ${p(r.current)} now. If it ${r.at > r.current ? 'rises' : 'falls'} to ${p(r.at)}, ${r.newLeader} ranks first instead of ${f.leader}.`);
    return `Computed facts:\n- ${f.leader} ranks first, ${(f.margin * 100).toFixed(1)} points ahead of ${f.runnerUp}.\n${lines.join('\n')}\n- No single weight change alters the leader for: ${f.stable.join(', ') || 'none'}.\nWrite a 1–2 sentence summary naming the change closest to the current weights, then up to 5 bullets. Use only these numbers.`;
  },
  schema: { type: 'object', properties: { summary: str, bullets: { type: 'array', items: str } }, required: ['summary', 'bullets'] },
  demo: demoSensitivity,
  fromLive: (raw) => ({ summary: toText(raw?.summary), bullets: texts(raw?.bullets) }),
};

const memo: TaskDef<MemoFacts, string> = {
  label: 'Draft decision memo',
  system:
    GUARDRAIL +
    '\nTask: draft a Source Selection Decision Document in Markdown from the evaluation record. Leave section 9 "Decision" for the SSA to complete. Do not recommend a selection.',
  user: (f) => `Evaluation record:\n${JSON.stringify(f, null, 2)}\nUse these sections: 1 Purpose, 2 Proposals and screening, 3 How the evaluation was done (with a weights table), 4 Results (ranking table), 5 What separates the proposals, 6 Sensitivity, 7 Evidence notes, 8 Recorded disagreement, 9 Decision (placeholder).`,
  schema: { type: 'object', properties: { markdown: str }, required: ['markdown'] },
  demo: demoMemo,
  fromLive: (raw) => toText(raw?.markdown),
};

export const TASKS = { hierarchy, evidence, coach, discussion, sensitivity, memo };
export type TaskName = keyof typeof TASKS;
type In<K extends TaskName> = (typeof TASKS)[K] extends TaskDef<infer I, any> ? I : never;
type Out<K extends TaskName> = (typeof TASKS)[K] extends TaskDef<any, infer O> ? O : never;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runTask<K extends TaskName>(name: K, input: In<K>, opts: AIOptions): Promise<AIResult<Out<K>>> {
  const def = TASKS[name] as unknown as TaskDef<In<K>, Out<K>>;
  const t0 = performance.now();
  if (opts.provider === 'demo') {
    await sleep(650 + Math.random() * 600);
    return { data: def.demo(input), source: 'demo', model: 'scripted demo', ms: performance.now() - t0 };
  }
  const r = await callLLM(opts, opts.apiKey, { system: def.system, user: def.user(input), schema: def.schema, label: def.label });
  const data = def.fromLive ? def.fromLive(r.data, input) : (r.data as Out<K>);
  return { data, source: 'live', model: r.model, ms: performance.now() - t0 };
}
