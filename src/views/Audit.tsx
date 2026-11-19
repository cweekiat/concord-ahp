import { useState } from 'react';
import { expertById } from '../data/scenario';
import { Badge, Section, Segmented, StepHeader } from '../components/ui';
import { useStore } from '../state/store';
import type { AuditEntry } from '../state/types';

const TONE: Record<AuditEntry['kind'], 'indigo' | 'green' | 'red' | 'gray' | 'blue' | 'orange'> = {
  ai: 'indigo', accept: 'green', reject: 'red', edit: 'gray', verify: 'green', judgment: 'blue', decision: 'orange', note: 'gray', system: 'gray',
};
const KIND: Record<AuditEntry['kind'], string> = {
  ai: 'AI suggestion', accept: 'Accepted', reject: 'Rejected', edit: 'Edited', verify: 'Verified', judgment: 'Judgment', decision: 'Decision', note: 'Note', system: 'System',
};

export default function Audit() {
  const { state } = useStore();
  const [filter, setFilter] = useState<'all' | 'ai' | 'human'>('all');
  const rows = [...state.audit].reverse().filter((e) => (filter === 'all' ? true : filter === 'ai' ? e.actor === 'ai' : e.actor !== 'ai' && e.actor !== 'system'));
  const who = (a: AuditEntry['actor']) => (a === 'ai' ? 'AI assistant' : a === 'system' ? 'System' : `${expertById(a).name} (${expertById(a).role})`);
  return (
    <>
      <StepHeader eyebrow="Reference" title="Audit log"  />
      <div style={{ marginBottom: 12 }}>
        <Segmented label="Filter entries" value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${state.audit.length})` }, { value: 'ai', label: 'AI' }, { value: 'human', label: 'People' }]} />
      </div>
      <Section>
        <div className="card">
          {rows.length === 0 && <div className="row secondary">Nothing here yet.</div>}
          {rows.map((e) => (
            <div className="row" key={e.id} style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 120, flex: 'none' }}>
                <Badge tone={TONE[e.kind]}>{KIND[e.kind]}</Badge>
                <div className="caption tertiary" style={{ marginTop: 4 }}>{new Date(e.at).toLocaleTimeString()}</div>
              </div>
              <div className="grow">
                <div className="subhead">{e.summary}</div>
                <div className="footnote secondary">{who(e.actor)} · {e.step}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
