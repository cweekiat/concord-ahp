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

export interface AIOptions {
  mode: 'demo' | 'live';
  apiKey: string;
  model: string;
}

export interface AIResult<T> {
  data: T;
  source: 'demo' | 'live';
  model: string;
  ms: number;
}

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (balanced)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest)' },
];

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
  fromLive: (raw) => [...(raw.rows as ExtractionRow[]).filter((r) => r.leaf !== 'lcc'), ...DEMO_EXTRACTION.filter((r) => r.leaf === 'lcc')],
};

const coach: TaskDef<CoachFacts, CoachNote> = {
  label: 'Explain inconsistency',
  system: GUARDRAIL + '\nTask: help one evaluator understand why their pairwise judgments are inconsistent. The maths has already been done; explain it. Do not tell them what to choose.',
  user: (f) => `Facts (computed by the AHP engine):\n${JSON.stringify(f, null, 2)}\nWrite a 3–4 sentence explanation addressed to the evaluator, then one neutral question that asks what they meant.`,
  schema: { type: 'object', properties: { explanation: str, question: str }, required: ['explanation', 'question'] },
  demo: demoCoach,
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
  fromLive: (raw) => raw.prompts,
};

const sensitivity: TaskDef<SensitivityFacts, SensitivityNote> = {
  label: 'Explain sensitivity',
  system: GUARDRAIL + '\nTask: explain one-at-a-time sensitivity results to a decision-maker in plain language.',
  user: (f) => `Sensitivity facts (computed):\n${JSON.stringify(f, null, 2)}\nWrite a 1–2 sentence summary and up to 5 bullets. Weights are fractions; show them as percentages.`,
  schema: { type: 'object', properties: { summary: str, bullets: { type: 'array', items: str } }, required: ['summary', 'bullets'] },
  demo: demoSensitivity,
};

const memo: TaskDef<MemoFacts, string> = {
  label: 'Draft decision memo',
  system:
    GUARDRAIL +
    '\nTask: draft a Source Selection Decision Document in Markdown from the evaluation record. Leave section 9 "Decision" for the SSA to complete. Do not recommend a selection.',
  user: (f) => `Evaluation record:\n${JSON.stringify(f, null, 2)}\nUse these sections: 1 Purpose, 2 Proposals and screening, 3 How the evaluation was done (with a weights table), 4 Results (ranking table), 5 What separates the proposals, 6 Sensitivity, 7 Evidence notes, 8 Recorded disagreement, 9 Decision (placeholder).`,
  schema: { type: 'object', properties: { markdown: str }, required: ['markdown'] },
  demo: demoMemo,
  fromLive: (raw) => raw.markdown,
};

export const TASKS = { hierarchy, evidence, coach, discussion, sensitivity, memo };
export type TaskName = keyof typeof TASKS;
type In<K extends TaskName> = (typeof TASKS)[K] extends TaskDef<infer I, any> ? I : never;
type Out<K extends TaskName> = (typeof TASKS)[K] extends TaskDef<any, infer O> ? O : never;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runTask<K extends TaskName>(name: K, input: In<K>, opts: AIOptions): Promise<AIResult<Out<K>>> {
  const def = TASKS[name] as unknown as TaskDef<In<K>, Out<K>>;
  const t0 = performance.now();
  if (opts.mode === 'demo' || !opts.apiKey) {
    await sleep(650 + Math.random() * 600);
    return { data: def.demo(input), source: 'demo', model: 'scripted demo', ms: performance.now() - t0 };
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system: def.system,
      messages: [{ role: 'user', content: def.user(input) }],
      tools: [{ name: 'respond', description: `Return the result of: ${def.label}`, input_schema: def.schema }],
      tool_choice: { type: 'tool', name: 'respond' },
    }),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      /* keep status text */
    }
    throw new Error(`Claude API: ${msg}`);
  }
  const body = await res.json();
  const block = body?.content?.find((b: any) => b.type === 'tool_use');
  if (!block) throw new Error('Claude API returned no structured result.');
  const data = def.fromLive ? def.fromLive(block.input, input) : (block.input as Out<K>);
  return { data, source: 'live', model: body.model ?? opts.model, ms: performance.now() - t0 };
}
