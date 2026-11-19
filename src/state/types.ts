import type { AltId, CriterionId, ExpertId } from '../data/scenario';

export type StepId =
  | 'overview'
  | 'dashboard'
  | 'setup'
  | 'hierarchy'
  | 'evidence'
  | 'judgments'
  | 'group'
  | 'scoring'
  | 'results'
  | 'decision'
  | 'savings'
  | 'audit'
  | 'method';

export interface EvidenceCell {
  value: number | null;
  status: 'empty' | 'ai' | 'verified';
  aiValue?: number;
  quote?: string;
  source?: string;
  confidence?: number;
  flag?: string;
  flagKind?: 'ambiguity' | 'unit' | 'threshold';
  verifiedBy?: ExpertId;
  correctedFrom?: number;
}

export interface HierarchyDraft {
  criteria: Array<{
    name: string;
    rationale: string;
    reqRef: string;
    subcriteria: Array<{ name: string; measure: string; threshold?: string; objective?: string; reqRef: string }>;
  }>;
  screeningRules: string[];
  gaps: string[];
}

export interface DiscussionPrompt {
  criterion: CriterionId;
  addressedTo: ExpertId[];
  question: string;
  why: string;
}

export interface SensitivityNote {
  summary: string;
  bullets: string[];
}

export interface Decision {
  alt: AltId;
  rationale: string;
  signedBy: ExpertId;
  at: string;
  followsRanking: boolean;
}

export type AuditKind = 'ai' | 'accept' | 'reject' | 'edit' | 'verify' | 'judgment' | 'decision' | 'note' | 'system';

export interface AuditEntry {
  id: string;
  at: string;
  actor: ExpertId | 'ai' | 'system';
  kind: AuditKind;
  step: StepId;
  summary: string;
  /** Email of the person at the keyboard (self-declared unless accounts are added). */
  by?: string;
}

export interface State {
  v: 4;
  persona: ExpertId;
  goal: string;
  hierarchy: 'empty' | 'drafted' | 'approved';
  hierarchyDraft: HierarchyDraft | null;
  evidence: Record<string, EvidenceCell>;
  screeningConfirmed: boolean;
  judgments: Record<ExpertId, number[]>;
  area: Partial<Record<CriterionId, number[]>>;
  qual: Record<string, number[]>;
  excludeInconsistent: boolean;
  discussion: { prompts: DiscussionPrompt[] | null; notes: Record<string, string>; done: Record<string, boolean> };
  sensitivityNote: SensitivityNote | null;
  memo: string | null;
  decision: Decision | null;
  audit: AuditEntry[];
}

export const cellKey = (alt: AltId, leaf: string) => `${alt}:${leaf}`;
