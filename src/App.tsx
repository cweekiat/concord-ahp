import { useEffect, useRef, useState, type ComponentType } from 'react';
import { CR_LIMIT } from './ahp/engine';
import { EXPERTS, expertById, type ExpertId } from './data/scenario';
import { Badge, Button, ConfirmSheet, Icon, NavContext, Sheet, Toggle } from './components/ui';
import { PROVIDERS, describeConfig, testConnection, type ProviderId } from './ai/providers';
import { exportJSON, importJSON, initialState, preparedState, useStore } from './state/store';
import type { StepId } from './state/types';
import Overview from './views/Overview';
import { IncomingLink, ShareSheet } from './components/Share';
import { Tour } from './components/Tour';
import { ErrorBoundary } from './components/ErrorBoundary';
import Dashboard from './views/Dashboard';
import { PROCESS, stepDone } from './state/progress';
import Setup from './views/Setup';
import Hierarchy from './views/Hierarchy';
import Evidence from './views/Evidence';
import Judgments from './views/Judgments';
import Group from './views/Group';
import Scoring from './views/Scoring';
import Results from './views/Results';
import Decision from './views/Decision';
import Savings from './views/Savings';
import Audit from './views/Audit';
import Method from './views/Method';

const VIEWS: Record<StepId, ComponentType> = {
  overview: Overview, dashboard: Dashboard, setup: Setup, hierarchy: Hierarchy, evidence: Evidence, judgments: Judgments, group: Group,
  scoring: Scoring, results: Results, decision: Decision, savings: Savings, audit: Audit, method: Method,
};

const REFERENCE: Array<{ id: StepId; label: string; icon: 'clock' | 'list' | 'book' }> = [
  { id: 'savings', label: 'Resources saved', icon: 'clock' },
  { id: 'audit', label: 'Audit log', icon: 'list' },
  { id: 'method', label: 'Method', icon: 'book' },
];

function readHash(): StepId {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as StepId;
  return h in VIEWS ? h : 'overview';
}

/** #/join?d=… or #/merge?d=… — shared links. */
function readIncoming(): string | null {
  const m = window.location.hash.match(/^#\/(join|merge)\?d=([A-Za-z0-9_-]+)/);
  return m ? m[2] : null;
}

export default function App() {
  const { state, model, update, replace, aiConfig } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [step, setStep] = useState<StepId>(readHash);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [share, setShare] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const [incoming, setIncoming] = useState<string | null>(readIncoming);
  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const nav = navRef.current;
    (nav?.querySelector<HTMLButtonElement>('[aria-current="page"]') ?? nav?.querySelector<HTMLButtonElement>('.nav-item'))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.querySelector<HTMLButtonElement>('.menu-button')?.focus();
    };
  }, [menu]);

  useEffect(() => {
    const on = () => {
      setStep(readHash());
      const d = readIncoming();
      if (d) setIncoming(d);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const titles: Partial<Record<StepId, string>> = { overview: 'Concord: AHP with AI', dashboard: 'Dashboard · Concord' };
    document.title = titles[step] ?? `${[...PROCESS, ...REFERENCE].find((p) => p.id === step)?.label} · Concord`;
  }, [step]);

  const go = (s: StepId) => {
    if (window.location.hash !== `#/${s}`) window.location.hash = `/${s}`;
    setStep(s);
    setMenu(false);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  };

  const done = stepDone(state, model);

  const View = VIEWS[step];
  const me = expertById(state.persona);

  return (
    <NavContext.Provider value={{ go, current: step, openSettings: () => setSettings(true), openShare: () => setShare(true), startTour: () => setTour(0) }}>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <div className="shell">
        {menu && <div className="scrim" onClick={() => setMenu(false)} aria-hidden />}
        <nav ref={navRef} className={`sidebar${menu ? ' open' : ''}`} aria-label="Steps" {...(compact && !menu ? { inert: '' as any, 'aria-hidden': true } : {})}>
          <div className="brand">
            <span className="brand-mark"><Icon name="scale" size={18} /></span>
            <div>
              <div className="brand-name">Concord</div>
              <div className="brand-sub">AHP decisions, AI-assisted</div>
            </div>
          </div>
          <ul className="nav-list">
            <li>
              <button className="nav-item" aria-current={step === 'overview' ? 'page' : undefined} onClick={() => go('overview')}>
                <span className="nav-icon"><Icon name="home" /></span> Overview
              </button>
            </li>
            <li>
              <button className="nav-item" aria-current={step === 'dashboard' ? 'page' : undefined} onClick={() => go('dashboard')}>
                <span className="nav-icon"><Icon name="chart" /></span> Dashboard
              </button>
            </li>
          </ul>
          <div className="nav-section" id="nav-process">Evaluation · Project TERN</div>
          <ol className="nav-list" aria-labelledby="nav-process">
            {PROCESS.map((p, i) => (
              <li key={p.id}>
                <button className="nav-item" aria-current={step === p.id ? 'page' : undefined} onClick={() => go(p.id)}>
                  <span className={`nav-num${done[p.id] && step !== p.id ? ' done' : ''}`} aria-hidden>
                    {done[p.id] && step !== p.id ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  {p.label}
                  {done[p.id] && <span className="sr-only">, complete</span>}
                </button>
              </li>
            ))}
          </ol>
          <div className="nav-section" id="nav-ref">Reference</div>
          <ul className="nav-list" aria-labelledby="nav-ref">
            {REFERENCE.map((p) => (
              <li key={p.id}>
                <button className="nav-item" aria-current={step === p.id ? 'page' : undefined} onClick={() => go(p.id)}>
                  <span className="nav-icon"><Icon name={p.icon} /></span> {p.label}
                  {p.id === 'audit' && <span className="nav-state num">{state.audit.length}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="main">
          <header className="toolbar">
            <Button variant="plain" small className="menu-button" aria-label="Show steps" aria-expanded={menu} onClick={() => setMenu(true)}>
              <Icon name="sidebar" size={22} />
            </Button>
            <div className="persona-picker">
              <span className="avatar" aria-hidden>{me.initials}</span>
              <label className="sr-only" htmlFor="persona">Acting as</label>
              <span className="footnote secondary who" aria-hidden>Acting as</span>
              <select id="persona" className="plain" value={state.persona} onChange={(e) => update((s) => ({ ...s, persona: e.target.value as ExpertId }))}>
                {EXPERTS.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
              </select>
            </div>
            <span className="spacer" />
            <span className="mode-badge">
              {aiConfig.provider !== 'demo' ? <Badge tone="indigo">{aiConfig.provider === 'ollama' ? `Local · ${aiConfig.model}` : aiConfig.model}</Badge> : <Badge>Demo AI</Badge>}
            </span>
            <Button variant="plain" small aria-label="Share" onClick={() => setShare(true)}>
              <Icon name="share" size={22} />
            </Button>
            <Button variant="plain" small aria-label="Settings" onClick={() => setSettings(true)}>
              <Icon name="gear" size={22} />
            </Button>
          </header>
          <main id="main" className="content" ref={mainRef} tabIndex={-1} style={{ outline: 'none' }}>
            <ErrorBoundary resetKey={step} onReset={() => update((s) => ({ ...s, sensitivityNote: null, memo: null, discussion: { ...s.discussion, prompts: null }, hierarchyDraft: s.hierarchy === 'drafted' ? null : s.hierarchyDraft, hierarchy: s.hierarchy === 'drafted' ? 'empty' : s.hierarchy }))}>
              <View />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} go={go} onReset={() => setConfirmReset(true)} onTour={() => { setSettings(false); setTour(0); }} />
      <ShareSheet open={share} onClose={() => setShare(false)} />
      {incoming && (
        <IncomingLink
          data={incoming}
          onDone={() => {
            setIncoming(null);
            history.replaceState(null, '', `${location.pathname}#/overview`);
            setStep('overview');
          }}
        />
      )}
      {tour !== null && <Tour step={tour} go={go} onStep={setTour} onEnd={() => setTour(null)} />}
      <ConfirmSheet
        open={confirmReset}
        title="Start Over?"
        message="This clears the evaluation in this browser, including the audit log. It can’t be undone. Export a copy first if you want to keep it."
        confirmLabel="Start Over"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { replace(initialState()); setConfirmReset(false); go('overview'); }}
      />
    </NavContext.Provider>
  );
}

function SettingsSheet({ open, onClose, go, onReset, onTour }: { open: boolean; onClose: () => void; go: (s: StepId) => void; onReset: () => void; onTour: () => void }) {
  const { state, update, replace } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="stack" style={{ gap: 24 }}>
        <AISettings />

        <section className="stack">
          <h3 className="headline">Evaluation data</h3>
          <p className="footnote secondary" style={{ margin: 0 }}>Export to share with your team.</p>
          <div className="hstack">
            <Button onClick={() => {
              const url = URL.createObjectURL(new Blob([exportJSON(state)], { type: 'application/json' }));
              const a = document.createElement('a');
              a.href = url; a.download = 'tern-evaluation.json'; a.click(); URL.revokeObjectURL(url);
            }}><Icon name="download" /> Export</Button>
            <Button onClick={() => fileRef.current?.click()}><Icon name="upload" /> Import</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { replace(importJSON(await f.text())); setMsg('Imported.'); } catch (err) { setMsg(err instanceof Error ? err.message : 'Import failed.'); }
              e.target.value = '';
            }} />
          </div>
          {msg && <p className="footnote" role="status" style={{ margin: 0 }}>{msg}</p>}
        </section>

        <section className="stack">
          <h3 className="headline">Help</h3>
          <div className="hstack">
            <Button variant="filled" onClick={onTour}>Take the tour</Button>
            <span className="footnote secondary">10 steps</span>
          </div>
        </section>

        <section className="stack">
          <h3 className="headline">Demo shortcuts</h3>
          <div className="hstack">
            <Button onClick={() => { update((s) => preparedState(s)); onClose(); go('judgments'); }}>Skip to judgments</Button>
            <Button variant="destructive" onClick={() => { onClose(); onReset(); }}>Start over</Button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

function AISettings() {
  const { aiConfig, aiSettings, setAISettings, apiKey, setApiKey, keyRemembered } = useStore();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const set = (patch: Partial<typeof aiSettings>) => {
    setAISettings({ ...aiSettings, ...patch });
    setStatus(null);
  };

  return (
    <section className="stack">
      <h3 className="headline">AI</h3>
      <div className="row" style={{ padding: 0, minHeight: 44 }}>
        <span className="grow">Demo mode <span className="footnote secondary">· scripted, offline</span></span>
        <Toggle checked={aiSettings.demo} label="Demo mode" onChange={(v) => set({ demo: v })} />
      </div>
      {!aiSettings.demo && (
        <>
          <div className="field">
            <label htmlFor="key">API key</label>
            <input id="key" className="input mono" type="password" autoComplete="off" spellCheck={false} placeholder="Paste a Claude key (sk-ant-…), or leave empty for local" value={apiKey} onChange={(e) => { setApiKey(e.target.value.trim()); setStatus(null); }} />
            <span className="footnote secondary">Using {describeConfig(aiConfig)}</span>
          </div>
          {apiKey && (
            <div className="row" style={{ padding: 0, minHeight: 44 }}>
              <span className="grow subhead">Remember key on this device</span>
              <Toggle checked={keyRemembered} label="Remember API key on this device" onChange={(v) => setApiKey(apiKey, v)} />
            </div>
          )}
          <div className="hstack">
            <Button
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                setStatus(null);
                try {
                  setStatus({ ok: true, text: await testConnection(aiConfig, apiKey) });
                } catch (e) {
                  setStatus({ ok: false, text: e instanceof Error ? e.message : String(e) });
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            {status && <span role="status" className="footnote" style={{ color: status.ok ? 'var(--green-text)' : 'var(--red-text)' }}>{status.text}</span>}
          </div>
          <details>
            <summary className="footnote" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', color: 'var(--tint-text)' }}>Advanced: other providers and endpoints</summary>
            <div className="stack" style={{ paddingTop: 4 }}>
              <div className="row" style={{ padding: 0, minHeight: 44 }}>
                <span className="grow subhead">Detect provider from key</span>
                <Toggle checked={aiSettings.auto} label="Detect provider from key" onChange={(v) => set({ auto: v, ...(v ? {} : { provider: aiConfig.provider, baseUrl: aiConfig.baseUrl, model: aiConfig.model }) })} />
              </div>
              {!aiSettings.auto && (
                <>
                  <div className="field">
                    <label htmlFor="provider">Provider</label>
                    <select id="provider" className="plain" value={aiSettings.provider} onChange={(e) => { const p = e.target.value as ProviderId; set({ provider: p, baseUrl: PROVIDERS[p].baseUrl, model: PROVIDERS[p].models[0] ?? '' }); }}>
                      {(Object.keys(PROVIDERS) as ProviderId[]).filter((p) => p !== 'demo').map((p) => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="base">Endpoint</label>
                    <input id="base" className="input mono" spellCheck={false} value={aiSettings.baseUrl} onChange={(e) => set({ baseUrl: e.target.value.trim() })} />
                  </div>
                  <div className="field">
                    <label htmlFor="model">Model</label>
                    <input id="model" className="input mono" list="model-list" spellCheck={false} value={aiSettings.model} onChange={(e) => set({ model: e.target.value.trim() })} />
                    <datalist id="model-list">{PROVIDERS[aiSettings.provider].models.map((m) => <option key={m} value={m} />)}</datalist>
                  </div>
                </>
              )}
              <p className="footnote secondary" style={{ margin: 0 }}>Local models need browser access: <code>OLLAMA_ORIGINS="*" ollama serve</code>. Calls go straight from this browser to the provider.</p>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
