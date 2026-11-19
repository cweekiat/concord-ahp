import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StepId } from '../state/types';
import { useStore } from '../state/store';
import { runTask, type AIResult, type TaskName } from '../ai/tasks';
import { savingFor } from '../data/savings';

/* ---------------- Navigation context ---------------- */
export const NavContext = createContext<{ go: (s: StepId) => void; current: StepId }>({ go: () => {}, current: 'overview' });
export const useNav = () => useContext(NavContext);

/* ---------------- Icons (simple strokes, SF-Symbols-like) ---------------- */
type IconName =
  | 'sparkles' | 'person' | 'check' | 'chevronRight' | 'chevronLeft' | 'sidebar' | 'doc' | 'chart' | 'gear'
  | 'clock' | 'list' | 'scale' | 'flag' | 'xmark' | 'info' | 'tree' | 'people' | 'table' | 'slider' | 'signature' | 'book' | 'home' | 'warn' | 'download' | 'upload';

const PATHS: Record<IconName, string> = {
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  sidebar: 'M4 5h16v14H4zM9 5v14',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 00-2.2-1.3L14.4 3h-4l-.4 2.4a7.5 7.5 0 00-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 000 2.6l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 002.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 002.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-13v4.5l3 2',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  scale: 'M12 4v16M6 20h12M4 9l3-5 3 5a3 3 0 01-6 0zm10 0l3-5 3 5a3 3 0 01-6 0zM7 4h10',
  flag: 'M6 21V4.5c3.5-2 6.5 2 12 0v8.5c-5.5 2-8.5-2-12 0',
  xmark: 'M6 6l12 12M18 6L6 18',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-10v6m0-9.5v.01',
  tree: 'M12 4v5M5 14v-2.5h14V14M5 14v3M12 9v8M19 14v3M9 4h6M3 17h4v3H3zM10 17h4v3h-4zM17 17h4v3h-4z',
  people: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-6 9a6 6 0 0112 0m1.5-9.2a3 3 0 10-.8-5.8M21 20a5 5 0 00-4-4.9',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  slider: 'M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5',
  signature: 'M3 17c3-1 4-9 6-9s-1 9 1 9 3-4 4-4 1 3 3 3 2-1 3-1M3 21h18',
  book: 'M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2zm0 0v15M8 7h7',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  warn: 'M12 4l9 16H3zM12 10v4m0 3v.01',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  upload: 'M12 16V5m0 0L8 9m4-4l4 4M5 20h14',
};

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------------- Primitives ---------------- */
type BtnVariant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'ai';
export function Button({ variant = 'tinted', small, children, ...rest }: { variant?: BtnVariant; small?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn ${variant}${small ? ' small' : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'blue' | 'green' | 'orange' | 'red' | 'indigo'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Section({ title, subtitle, action, footer, children, id }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; footer?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      {(title || action) && (
        <div className="section-head">
          <div>
            {title && <h2 id={id}>{title}</h2>}
            {subtitle && <p className="footnote secondary">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
      {footer && <div className="section-foot">{footer}</div>}
    </section>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const idx = options.findIndex((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (idx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button key={o.value} ref={(el) => (refs.current[i] = el)} role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="toggle">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onCancel={onClose} aria-label={title} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <>
          <div className="sheet-head">
            <span style={{ width: 60 }} />
            <h2>{title}</h2>
            <Button variant="plain" small onClick={onClose}>
              Done
            </Button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function ConfirmSheet({ open, title, message, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="gray" onClick={onCancel} autoFocus>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Sheet>
  );
}

export function Avatar({ initials, large }: { initials: string; large?: boolean }) {
  return (
    <span className={`avatar${large ? ' lg' : ''}`} aria-hidden>
      {initials}
    </span>
  );
}

export function StepHeader({ eyebrow, title, lede, ai, human }: { eyebrow?: string; title: string; lede: ReactNode; ai?: string[]; human?: string[] }) {
  return (
    <header className="step-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="large-title">{title}</h1>
      <p className="lede">{lede}</p>
      {(ai || human) && (
        <div className="roles">
          {ai && (
            <div className="role-card ai">
              <h3>
                <Icon name="sparkles" size={16} /> AI prepares
              </h3>
              <ul>{ai.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          {human && (
            <div className="role-card human">
              <h3>
                <Icon name="person" size={16} /> People decide
              </h3>
              <ul>{human.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function Callout({ tone = 'info', icon = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'ok'; icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const color = tone === 'warn' ? 'var(--orange-text)' : tone === 'ok' ? 'var(--green-text)' : 'var(--tint-text)';
  return (
    <div className={`callout ${tone}`} role={tone === 'warn' ? 'status' : undefined}>
      <span style={{ color, marginTop: 2 }}>
        <Icon name={icon} size={20} />
      </span>
      <div className="grow">
        <p className="headline" style={{ margin: 0 }}>{title}</p>
        {children && <div className="subhead secondary">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Gate({ blockers }: { blockers: string[] }) {
  const { go } = useNav();
  return (
    <Callout tone="warn" icon="warn" title="Some earlier steps aren’t finished" action={<Button small onClick={() => go(blockers[0]?.includes('hierarchy') ? 'hierarchy' : 'evidence')}>Go there</Button>}>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
    </Callout>
  );
}

const ORDER: StepId[] = ['overview', 'setup', 'hierarchy', 'evidence', 'judgments', 'group', 'scoring', 'results', 'decision', 'savings'];
const LABEL: Record<StepId, string> = {
  overview: 'Overview', setup: 'Set up', hierarchy: 'Criteria', evidence: 'Evidence', judgments: 'Judgments', group: 'Group view',
  scoring: 'Scoring', results: 'Results', decision: 'Decision', savings: 'Resources saved', audit: 'Audit log', method: 'Method',
};
export function Pager({ here }: { here: StepId }) {
  const { go } = useNav();
  const i = ORDER.indexOf(here);
  const prev = ORDER[i - 1];
  const next = ORDER[i + 1];
  return (
    <nav className="pager" aria-label="Step navigation">
      {prev ? (
        <Button variant="gray" onClick={() => go(prev)}>
          <Icon name="chevronLeft" /> {LABEL[prev]}
        </Button>
      ) : <span />}
      {next && (
        <Button variant="filled" onClick={() => go(next)}>
          Next: {LABEL[next]} <Icon name="chevronRight" />
        </Button>
      )}
    </nav>
  );
}

/* ---------------- AI ---------------- */
export function useAI() {
  const { state, apiKey } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<K extends TaskName>(name: K, input: Parameters<typeof runTask<K>>[1]): Promise<AIResult<any> | null> {
    setBusy(true);
    setError(null);
    try {
      return await runTask(name, input, { mode: state.aiMode, apiKey, model: state.model });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, live: state.aiMode === 'live' && !!apiKey };
}

export function AIButton({ busy, children, onClick, disabled, busyLabel = 'Working…' }: { busy: boolean; children: ReactNode; onClick: () => void; disabled?: boolean; busyLabel?: string }) {
  return (
    <Button variant="ai" onClick={onClick} disabled={busy || disabled} aria-busy={busy}>
      {busy ? <span className="spinner" aria-hidden /> : <Icon name="sparkles" />}
      {busy ? busyLabel : children}
    </Button>
  );
}

export function Provenance({ result, step }: { result: { source: 'demo' | 'live'; model: string; ms: number } | null; step?: StepId }) {
  if (!result) return null;
  const saved = step ? savingFor(step) : 0;
  return (
    <span className="provenance">
      {result.source === 'demo' ? 'Scripted demo response' : `Live · ${result.model}`} · {(result.ms / 1000).toFixed(1)} s
      {saved > 0 && <> · saves about {saved.toFixed(0)} h compared with doing it by hand (illustrative)</>}
    </span>
  );
}

export function AICard({ title, provenance, children, footer }: { title: string; provenance?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="ai-card" role="region" aria-label={`AI suggestion: ${title}`}>
      <div className="ai-card-head">
        <span style={{ color: 'var(--indigo-text)' }}>
          <Icon name="sparkles" />
        </span>
        <div style={{ flex: 1 }}>
          <p className="headline" style={{ fontSize: '0.9375rem' }}>{title}</p>
          {provenance}
        </div>
        <Badge tone="indigo">Suggestion</Badge>
      </div>
      <div className="ai-card-body">{children}</div>
      {footer && <div className="ai-card-foot">{footer}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Callout tone="warn" icon="warn" title="The AI request failed">
      {error}. Nothing was changed. You can try again, or switch to demo mode in Settings.
    </Callout>
  );
}

/* ---------------- Markdown (tiny, safe: builds React nodes, no innerHTML) ---------------- */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**') ? <strong key={k++}>{t.slice(2, -2)}</strong> : <em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# ')) { blocks.push(<h1 key={k++}>{inline(line.slice(2))}</h1>); i++; continue; }
    if (line.startsWith('## ')) { blocks.push(<h2 key={k++}>{inline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s|:-]+\|$/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <table key={k++}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
      blocks.push(<ul key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    blocks.push(<p key={k++}>{inline(line)}</p>);
    i++;
  }
  return <div className="doc">{blocks}</div>;
}

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
