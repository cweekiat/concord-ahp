import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StepId } from '../state/types';
import { Button } from './ui';

interface TourStep {
  route: StepId;
  /** First selector that matches wins; none → centred card. */
  targets: string[];
  title: string;
  body: string;
}

/** Ten steps, the maximum. */
export const TOUR: TourStep[] = [
  { route: 'overview', targets: ['.hero h1'], title: 'Welcome to Concord', body: 'A team AHP evaluation. AI does the groundwork; people make every judgment.' },
  { route: 'overview', targets: ['nav.sidebar ol'], title: 'Eight steps', body: 'From criteria to a signed decision. Ticks show what’s done.' },
  { route: 'overview', targets: ['.persona-picker'], title: 'Act as anyone', body: 'Switch team member here. Each person can change only what they own.' },
  { route: 'hierarchy', targets: ['.btn.ai', '.tree', '.roles'], title: 'Criteria', body: 'AI drafts criteria from the requirements. The PM approves.' },
  { route: 'evidence', targets: ['.btn.ai', 'table.data', '.roles'], title: 'Evidence', body: 'AI extracts datasheet values with source quotes and flags doubts. Owners verify.' },
  { route: 'judgments', targets: ['.pair', '.roles'], title: 'Judgments', body: 'Drag toward what matters more. If answers conflict, the coach finds the cause.' },
  { route: 'results', targets: ['figure', '.gate, .callout'], title: 'Results', body: 'Ranking plus the exact weights at which the winner would change.' },
  { route: 'decision', targets: ['.btn.ai', '.ai-card', '.callout'], title: 'Decision', body: 'AI drafts the decision document. Only the SSA signs.' },
  { route: 'dashboard', targets: ['[aria-label="AHP decision hierarchy"]', '.kpi-grid'], title: 'Dashboard', body: 'Progress, open actions, hierarchy and radar for management.' },
  { route: 'overview', targets: ['[aria-label="Share"]'], title: 'Work together', body: 'Invite colleagues by email. They send their input back as a link. No accounts.' },
];

export function Tour({ step, go, onStep, onEnd }: { step: number; go: (s: StepId) => void; onStep: (n: number) => void; onEnd: () => void }) {
  const s = TOUR[step];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    go(s.route);
    setRect(null);
    let el: Element | null = null;
    let timer = 0;
    let last = '';
    // Follow the target (80 ms poll, works even where rAF is throttled): closing sheets, focus restoration and scrolling all move it.
    const track = () => {
      if (el) {
        const r = el.getBoundingClientRect();
        const key = `${r.top}|${r.left}|${r.width}|${r.height}`;
        if (key !== last) {
          last = key;
          setRect(r);
        }
      }
    };
    const t = setTimeout(() => {
      for (const sel of s.targets) {
        const found = document.querySelector(sel);
        if (found && (found as HTMLElement).offsetParent !== null) {
          el = found;
          break;
        }
      }
      el?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      cardRef.current?.focus({ preventScroll: true });
      track();
      timer = window.setInterval(track, 80);
    }, 300);
    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      if (e.key === 'ArrowRight' && step < TOUR.length - 1) onStep(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) onStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onEnd, onStep]);

  // Card placement: below the target if there's room, else above; centred when no target.
  const [pos, setPos] = useState<React.CSSProperties>({});
  useLayoutEffect(() => {
    const w = Math.min(340, window.innerWidth - 32);
    if (!rect) {
      setPos({ left: (window.innerWidth - w) / 2, top: window.innerHeight / 2 - 90, width: w });
      return;
    }
    const H = 180;
    const below = rect.bottom + 12 + H < window.innerHeight;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - w - 16);
    const top = below ? rect.bottom + 12 : rect.top - 12 - H;
    setPos({ left, width: w, top: Math.min(Math.max(16, top), window.innerHeight - H - 16) });
  }, [rect]);

  const pad = 6;
  return (
    <div className="tour" aria-live="polite">
      <div className="tour-scrim" onClick={onEnd} />
      {rect && <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />}
      <div ref={cardRef} className="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" tabIndex={-1} style={pos}>
        <div className="footnote secondary">{step + 1} of {TOUR.length}</div>
        <h2 id="tour-title" className="headline" style={{ margin: '2px 0 4px' }}>{s.title}</h2>
        <p className="subhead" style={{ margin: 0 }}>{s.body}</p>
        <div className="hstack" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <Button small variant="plain" onClick={onEnd}>Skip</Button>
          <span className="hstack">
            {step > 0 && <Button small variant="gray" onClick={() => onStep(step - 1)}>Back</Button>}
            {step < TOUR.length - 1 ? <Button small variant="filled" onClick={() => onStep(step + 1)}>Next</Button> : <Button small variant="filled" onClick={onEnd}>Done</Button>}
          </span>
        </div>
      </div>
    </div>
  );
}
