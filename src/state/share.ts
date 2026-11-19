/**
 * No-account collaboration over email.
 *
 *  PM ──invite link (role + slim evaluation)──▶ colleague's browser
 *  colleague ──response link (only their contribution + checksum)──▶ PM's browser → merge
 *
 * Links carry the data (deflate + base64url in the URL hash, never sent to a server).
 * Identity is self-declared name + email, stamped into the audit log. Accounts would make it verified.
 */
import { DEMO_EXTRACTION } from '../ai/demo';
import { CRITERIA, EXPERTS, QUAL_LEAVES, expertById, type CriterionId, type ExpertId } from '../data/scenario';
import type { Identity } from './store';
import type { Decision, EvidenceCell, State } from './types';

/* ---------------- encoding ---------------- */

async function deflate(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function inflate(b64: string): Promise<string> {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

async function checksum(obj: unknown): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(obj)));
  return Array.from(new Uint8Array(buf).slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
}

const appUrl = () => `${location.origin}${location.pathname}`;

/* ---------------- invite ---------------- */

type SlimCell = [value: number | null, status: 0 | 1 | 2, verifiedBy?: ExpertId | 0, correctedFrom?: number];

export interface Invite {
  t: 'invite';
  role: ExpertId;
  from: Identity;
  at: string;
  s: {
    goal: string;
    hierarchy: State['hierarchy'];
    screening: boolean;
    ev: Record<string, SlimCell>;
    j: State['judgments'];
    area: State['area'];
    qual: State['qual'];
  };
}

export async function inviteLink(state: State, role: ExpertId, from: Identity): Promise<string> {
  const ev: Record<string, SlimCell> = {};
  for (const [k, c] of Object.entries(state.evidence)) ev[k] = [c.value, c.status === 'verified' ? 2 : c.status === 'ai' ? 1 : 0, c.verifiedBy ?? 0, c.correctedFrom];
  const inv: Invite = {
    t: 'invite',
    role,
    from,
    at: new Date().toISOString(),
    s: { goal: state.goal, hierarchy: state.hierarchy, screening: state.screeningConfirmed, ev, j: state.judgments, area: state.area, qual: state.qual },
  };
  return `${appUrl()}#/join?d=${await deflate(JSON.stringify(inv))}`;
}

/** Turn an invite into a working local state for the colleague. Evidence quotes are rehydrated from the source documents. */
export function stateFromInvite(inv: Invite, base: State): State {
  const evidence: State['evidence'] = {};
  for (const [k, [value, st, by, corr]] of Object.entries(inv.s.ev)) {
    const [alt, leaf] = k.split(':');
    const x = DEMO_EXTRACTION.find((r) => r.alt === alt && r.leaf === leaf);
    const cell: EvidenceCell = { value, status: st === 2 ? 'verified' : st === 1 ? 'ai' : 'empty', aiValue: x?.value, quote: x?.quote, source: x?.source, confidence: x?.confidence, flag: x?.flag, flagKind: x?.flagKind };
    if (by) cell.verifiedBy = by;
    if (corr != null) cell.correctedFrom = corr;
    evidence[k] = cell;
  }
  return {
    ...base,
    persona: inv.role,
    goal: inv.s.goal,
    hierarchy: inv.s.hierarchy,
    hierarchyDraft: base.hierarchyDraft,
    evidence,
    screeningConfirmed: inv.s.screening,
    judgments: inv.s.j,
    area: inv.s.area,
    qual: inv.s.qual,
  };
}

/* ---------------- response ---------------- */

export interface Contribution {
  judgments?: number[];
  area?: Partial<Record<CriterionId, number[]>>;
  qual?: Record<string, number[]>;
  evidence?: Record<string, EvidenceCell>;
  notes?: Record<string, string>;
  decision?: Decision | null;
}

export interface ResponsePack {
  t: 'response';
  from: Identity & { role: ExpertId };
  at: string;
  c: Contribution;
  sum: string;
}

/** Only what this role owns. Nothing else leaves the colleague's browser. */
export function contributionOf(state: State, role: ExpertId): Contribution {
  const e = expertById(role);
  const c: Contribution = {};
  if (e.judges) c.judgments = state.judgments[role];
  const area: Contribution['area'] = {};
  for (const id of e.owns) if (state.area[id]) area[id] = state.area[id];
  if (Object.keys(area).length) c.area = area;
  const qual: Record<string, number[]> = {};
  for (const l of QUAL_LEAVES) if (e.owns.includes(CRITERIA.find((cr) => cr.leaves.includes(l))!.id)) qual[l.id] = state.qual[l.id];
  if (Object.keys(qual).length) c.qual = qual;
  const ev: Record<string, EvidenceCell> = {};
  for (const [k, cell] of Object.entries(state.evidence)) if (cell.verifiedBy === role) ev[k] = { value: cell.value, status: cell.status, verifiedBy: role, correctedFrom: cell.correctedFrom };
  if (Object.keys(ev).length) c.evidence = ev;
  const notes = Object.fromEntries(Object.entries(state.discussion.notes).filter(([, v]) => v.trim()));
  if (Object.keys(notes).length) c.notes = notes;
  if (role === 'ssa' && state.decision) c.decision = state.decision;
  return c;
}

export function describeContribution(c: Contribution): string[] {
  const out: string[] = [];
  if (c.judgments) out.push('21 criteria comparisons');
  if (c.area) out.push(`${Object.keys(c.area).length} sub-criteria matrix`);
  if (c.qual) out.push(`${Object.keys(c.qual).length} proposal comparison set`);
  if (c.evidence) out.push(`${Object.keys(c.evidence).length} verified evidence values`);
  if (c.notes) out.push(`${Object.keys(c.notes).length} discussion notes`);
  if (c.decision) out.push('signed decision');
  return out;
}

export async function responseLink(state: State, role: ExpertId, me: Identity): Promise<{ url: string; parts: string[] }> {
  const c = contributionOf(state, role);
  const pack: ResponsePack = { t: 'response', from: { ...me, role }, at: new Date().toISOString(), c, sum: await checksum(c) };
  return { url: `${appUrl()}#/merge?d=${await deflate(JSON.stringify(pack))}`, parts: describeContribution(c) };
}

export async function decodeLink(d: string): Promise<Invite | ResponsePack> {
  const obj = JSON.parse(await inflate(d));
  if (obj?.t === 'response') {
    const ok = (await checksum(obj.c)) === obj.sum;
    if (!ok) throw new Error('This response link was altered or truncated (checksum mismatch).');
  }
  if (obj?.t !== 'invite' && obj?.t !== 'response') throw new Error('Not a Concord link.');
  if (!EXPERTS.some((e) => e.id === (obj.t === 'invite' ? obj.role : obj.from.role))) throw new Error('Unknown role in link.');
  return obj;
}

export function mergeResponse(state: State, r: ResponsePack): State {
  const role = r.from.role;
  const c = r.c;
  let s = { ...state };
  if (c.judgments) s = { ...s, judgments: { ...s.judgments, [role]: c.judgments } };
  if (c.area) s = { ...s, area: { ...s.area, ...c.area } };
  if (c.qual) s = { ...s, qual: { ...s.qual, ...c.qual } };
  if (c.evidence) {
    const ev = { ...s.evidence };
    for (const [k, cell] of Object.entries(c.evidence)) ev[k] = { ...(ev[k] ?? {}), ...cell };
    s = { ...s, evidence: ev };
  }
  if (c.notes) s = { ...s, discussion: { ...s.discussion, notes: { ...s.discussion.notes, ...c.notes } } };
  if (c.decision) s = { ...s, decision: c.decision };
  return s;
}

export function mailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

