import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  ALTERNATIVES,
  PROGRAMME,
  QUANT_LEAVES,
  TRUE_VALUES,
  initialAreaJudgments,
  initialCriteriaJudgments,
  initialQualJudgments,
  leafCriterion,
} from '../data/scenario';
import { DEMO_EXTRACTION, DEMO_HIERARCHY } from '../ai/demo';
import { ENV_API_KEY, defaultAISettings, effectiveConfig, type AIConfig, type AISettings } from '../ai/providers';
import type { AuditEntry, AuditKind, State, StepId } from './types';
import { cellKey } from './types';
import { computeModel, type Model } from './derive';

const KEY = 'concord-ahp/state/v4';
const AI_KEY = 'concord-ahp/ai-settings';
const ME_KEY = 'concord-ahp/me';

export interface Identity {
  name: string;
  email: string;
}
const KEY_KEY = 'concord-ahp/api-key';


export function initialState(): State {
  return {
    v: 4,
    persona: 'pm',
    goal: PROGRAMME.goal,
    hierarchy: 'empty',
    hierarchyDraft: null,
    evidence: {},
    screeningConfirmed: false,
    judgments: initialCriteriaJudgments(),
    area: initialAreaJudgments(),
    qual: initialQualJudgments(),
    excludeInconsistent: false,
    discussion: { prompts: null, notes: {}, done: {} },
    sensitivityNote: null,
    memo: null,
    decision: null,
    audit: [
      {
        id: 'seed',
        at: new Date().toISOString(),
        actor: 'system',
        kind: 'system',
        step: 'setup',
        summary: 'Evaluation opened. Eight evaluators submitted their criteria judgments independently.',
      },
    ],
  };
}

/** Jump straight to "everything prepared, decision pending" for presenters in a hurry. */
export function preparedState(base: State): State {
  const evidence: State['evidence'] = {};
  for (const x of DEMO_EXTRACTION) {
    const leaf = QUANT_LEAVES.find((l) => l.id === x.leaf)!;
    evidence[cellKey(x.alt, x.leaf)] = {
      value: TRUE_VALUES[x.alt][x.leaf],
      aiValue: x.value,
      status: 'verified',
      quote: x.quote,
      source: x.source,
      confidence: x.confidence,
      flag: x.flag,
      flagKind: x.flagKind,
      verifiedBy: leafCriterion(leaf.id).owner,
    };
  }
  return {
    ...base,
    hierarchy: 'approved',
    hierarchyDraft: DEMO_HIERARCHY,
    evidence,
    screeningConfirmed: true,
    audit: [
      ...base.audit,
      stamp({ actor: 'system', kind: 'system', step: 'overview', summary: 'Loaded the prepared walkthrough: hierarchy approved, evidence verified, screening confirmed.' }),
    ],
  };
}

let counter = 0;
function stamp(e: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
  counter += 1;
  return { ...e, id: `${Date.now().toString(36)}-${counter}`, at: new Date().toISOString() };
}

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    return s && s.v === 4 ? s : null;
  } catch {
    return null;
  }
}

type Action = { type: 'update'; fn: (s: State) => State } | { type: 'replace'; state: State };

function reducer(s: State, a: Action): State {
  return a.type === 'update' ? a.fn(s) : a.state;
}

interface Store {
  state: State;
  model: Model;
  update: (fn: (s: State) => State) => void;
  replace: (s: State) => void;
  log: (kind: AuditKind, step: StepId, summary: string, actor?: AuditEntry['actor']) => void;
  apiKey: string;
  setApiKey: (k: string, remember?: boolean) => void;
  keyRemembered: boolean;
  /** Resolved config for calls (settings + key). */
  aiConfig: AIConfig;
  aiSettings: AISettings;
  setAISettings: (c: AISettings) => void;
  me: Identity;
  setMe: (m: Identity) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => load() ?? initialState());
  // AI settings belong to this device, not to the evaluation: never exported.
  const [aiSettings, setAISettingsState] = useState<AISettings>(() => {
    try {
      const raw = localStorage.getItem(AI_KEY);
      if (raw) return { ...defaultAISettings(), ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return defaultAISettings();
  });
  const setAISettings = useCallback((c: AISettings) => {
    setAISettingsState(c);
    try {
      localStorage.setItem(AI_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  }, []);
  // Who is using this browser — stamped on audit entries and on responses sent back by email.
  const [me, setMeState] = useState<Identity>(() => {
    try {
      return { name: '', email: '', ...JSON.parse(localStorage.getItem(ME_KEY) || '{}') };
    } catch {
      return { name: '', email: '' };
    }
  });
  const setMe = useCallback((m: Identity) => {
    setMeState(m);
    try {
      localStorage.setItem(ME_KEY, JSON.stringify(m));
    } catch {
      /* ignore */
    }
  }, []);
  // API key: memory only unless the user opts in to remembering it on this device.
  const [keyRemembered, setKeyRemembered] = useState(() => {
    try {
      return !!localStorage.getItem(KEY_KEY);
    } catch {
      return false;
    }
  });
  const [apiKey, setApiKeyState] = useState(() => {
    try {
      return localStorage.getItem(KEY_KEY) || ENV_API_KEY;
    } catch {
      return ENV_API_KEY;
    }
  });
  const setApiKey = useCallback((k: string, remember?: boolean) => {
    setApiKeyState(k);
    const keep = remember ?? keyRemembered;
    setKeyRemembered(keep);
    try {
      if (keep && k) localStorage.setItem(KEY_KEY, k);
      else localStorage.removeItem(KEY_KEY);
    } catch {
      /* ignore */
    }
  }, [keyRemembered]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode etc. — the app still works, it just won't remember */
    }
  }, [state]);

  const update = useCallback((fn: (s: State) => State) => dispatch({ type: 'update', fn }), []);
  const replace = useCallback((s: State) => dispatch({ type: 'replace', state: s }), []);
  const meRef = useRef(me);
  meRef.current = me;
  const log = useCallback(
    (kind: AuditKind, step: StepId, summary: string, actor?: AuditEntry['actor']) =>
      dispatch({
        type: 'update',
        fn: (s) => ({ ...s, audit: [...s.audit, stamp({ actor: actor ?? s.persona, kind, step, summary, by: actor === 'ai' || actor === 'system' ? undefined : meRef.current.email || undefined })] }),
      }),
    [],
  );
  const aiConfig = useMemo(() => effectiveConfig(aiSettings, apiKey), [aiSettings, apiKey]);
  const model = useMemo(() => computeModel(state), [state]);

  return <Ctx.Provider value={{ state, model, update, replace, log, apiKey, setApiKey, keyRemembered, aiConfig, aiSettings, setAISettings, me, setMe }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export function exportJSON(s: State): string {
  return JSON.stringify({ app: 'concord-ahp', exportedAt: new Date().toISOString(), state: s }, null, 2);
}

export function importJSON(text: string): State {
  const parsed = JSON.parse(text);
  const s = parsed?.state ?? parsed;
  if (!s || !s.judgments || (s.v !== 3 && s.v !== 4)) throw new Error('This file is not a Concord evaluation.');
  const { aiMode: _a, model: _m, ...rest } = s;
  return { ...rest, v: 4 } as State;
}

export { stamp, ALTERNATIVES };
