import { useEffect, useState } from 'react';
import { EXPERTS, PROGRAMME, expertById, type ExpertId } from '../data/scenario';
import { Avatar, Badge, Button, Callout, Icon, Sheet } from './ui';
import { useStore, type Identity } from '../state/store';
import { decodeLink, describeContribution, inviteLink, mailto, mergeResponse, responseLink, stateFromInvite, type Invite, type ResponsePack } from '../state/share';

const INVITER_KEY = 'concord-ahp/inviter';
function getInviter(): Identity | null {
  try {
    return JSON.parse(localStorage.getItem(INVITER_KEY) || 'null');
  } catch {
    return null;
  }
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Open the mail client. Long links may be cut by some mail apps, so the link is also copied. */
async function emailLink(to: string, subject: string, intro: string, url: string) {
  await copy(url);
  const body = url.length < 1800 ? `${intro}\n\n${url}\n` : `${intro}\n\n(The link is on your clipboard — paste it here.)\n`;
  window.location.href = mailto(to, subject, body);
}

function IdentityFields() {
  const { me, setMe } = useStore();
  return (
    <div className="grid-2">
      <div className="field">
        <label htmlFor="me-name">Your name</label>
        <input id="me-name" className="input" autoComplete="name" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="me-email">Your email</label>
        <input id="me-email" className="input" type="email" autoComplete="email" placeholder="name@agency.mil" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value.trim() })} />
      </div>
    </div>
  );
}

export function ShareSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, log } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const inviter = getInviter();
  const ready = me.name.trim() && validEmail(me.email);
  const role = state.persona;

  useEffect(() => setMsg(null), [open]);

  async function invite(r: ExpertId, how: 'copy' | 'email') {
    const url = await inviteLink(state, r, me);
    const e = expertById(r);
    if (how === 'copy') {
      setMsg((await copy(url)) ? `Invite for ${e.role} copied.` : url);
    } else {
      await emailLink('', `${PROGRAMME.name}: your input as ${e.role}`, `Hi,\n\nPlease add your input to the ${PROGRAMME.name} source selection as ${e.role}. Open the link, do your part, then press Share → Send my input.\n\nNo account needed.\n— ${me.name}`, url);
    }
    log('note', 'setup', `Invited ${e.role} via ${how === 'copy' ? 'copied link' : 'email'}.`);
  }

  async function send(how: 'copy' | 'email') {
    const { url, parts } = await responseLink(state, role, me);
    if (how === 'copy') setMsg((await copy(url)) ? 'Response link copied.' : url);
    else await emailLink(inviter?.email ?? '', `${PROGRAMME.name}: input from ${me.name} (${expertById(role).role})`, `Here is my input as ${expertById(role).role}: ${parts.join(', ') || 'nothing yet'}.\nOpen the link to merge it.`, url);
    log('note', 'setup', `Sent input as ${expertById(role).role}: ${parts.join(', ') || 'nothing'}.`);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Share">
      <div className="stack" style={{ gap: 22 }}>
        <section className="stack">
          <h3 className="headline">You</h3>
          <IdentityFields />
          {!ready && <p className="footnote secondary" style={{ margin: 0 }}>Needed so your input is traceable to you.</p>}
        </section>

        <section className="stack">
          <h3 className="headline">Send my input</h3>
          <p className="footnote secondary" style={{ margin: 0 }}>
            As {expertById(role).role}{inviter ? ` → ${inviter.name} (${inviter.email})` : ''}
          </p>
          <div className="hstack">
            <Button variant="filled" disabled={!ready} onClick={() => send('email')}><Icon name="upload" /> Email my input</Button>
            <Button disabled={!ready} onClick={() => send('copy')}>Copy link</Button>
          </div>
        </section>

        <section className="stack">
          <h3 className="headline">Invite colleagues</h3>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--bg-tertiary)' }}>
            {EXPERTS.filter((e) => e.id !== state.persona).map((e) => (
              <div className="row" key={e.id}>
                <Avatar initials={e.initials} />
                <span className="grow subhead">{e.role}</span>
                <Button small variant="plain" disabled={!ready} onClick={() => invite(e.id, 'copy')} aria-label={`Copy invite for ${e.role}`}>Copy</Button>
                <Button small disabled={!ready} onClick={() => invite(e.id, 'email')} aria-label={`Email invite to ${e.role}`}>Email</Button>
              </div>
            ))}
          </div>
        </section>

        {msg && <p role="status" className="footnote" style={{ margin: 0, color: 'var(--green-text)', overflowWrap: 'anywhere' }}>{msg}</p>}
        <p className="footnote secondary" style={{ margin: 0 }}>No accounts. Links carry the data; nothing goes to a server. Names and emails are self-declared and recorded in the audit log.</p>
      </div>
    </Sheet>
  );
}

/** Handles #/join?d=… and #/merge?d=… links. */
export function IncomingLink({ data, onDone }: { data: string; onDone: () => void }) {
  const { state, replace, update, log, me, setMe } = useStore();
  const [pack, setPack] = useState<Invite | ResponsePack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    decodeLink(data).then(setPack, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, [data]);

  const close = onDone;
  if (error) {
    return (
      <Sheet open onClose={close} title="Link problem" footer={<Button variant="filled" onClick={close}>OK</Button>}>
        <Callout tone="warn" icon="warn" title="This link can’t be opened">{error}</Callout>
      </Sheet>
    );
  }
  if (!pack) return null;

  if (pack.t === 'invite') {
    const e = expertById(pack.role);
    const ready = me.name.trim() && validEmail(me.email);
    return (
      <Sheet
        open
        onClose={close}
        title="You’re invited"
        footer={
          <>
            <Button variant="gray" onClick={close}>Not now</Button>
            <Button
              variant="filled"
              disabled={!ready}
              onClick={() => {
                try {
                  localStorage.setItem(INVITER_KEY, JSON.stringify(pack.from));
                } catch {
                  /* ignore */
                }
                replace(stateFromInvite(pack, state));
                log('system', 'setup', `Joined as ${e.role} via invite from ${pack.from.name} <${pack.from.email}>.`);
                close();
              }}
            >
              Join as {e.role}
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="hstack">
            <Avatar initials={e.initials} large />
            <div>
              <div className="headline">{e.role}</div>
              <div className="footnote secondary">From {pack.from.name} · {pack.from.email}</div>
            </div>
          </div>
          <IdentityFields />
          <p className="footnote secondary" style={{ margin: 0 }}>Replaces the evaluation in this browser with the shared copy. When done: Share → Email my input.</p>
        </div>
      </Sheet>
    );
  }

  const r = pack;
  const parts = describeContribution(r.c);
  return (
    <Sheet
      open
      onClose={close}
      title="Merge input"
      footer={
        <>
          <Button variant="gray" onClick={() => { log('reject', 'setup', `Declined input from ${r.from.name} <${r.from.email}> (${expertById(r.from.role).role}).`); close(); }}>Decline</Button>
          <Button
            variant="filled"
            onClick={() => {
              update((s) => mergeResponse(s, r));
              log('accept', 'setup', `Merged input from ${r.from.name} <${r.from.email}> as ${expertById(r.from.role).role}: ${parts.join(', ')}. Sent ${new Date(r.at).toLocaleString()}, checksum ${r.sum}.`);
              close();
            }}
          >
            Merge
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="hstack">
          <Avatar initials={expertById(r.from.role).initials} large />
          <div>
            <div className="headline">{r.from.name} · {expertById(r.from.role).role}</div>
            <div className="footnote secondary">{r.from.email} · {new Date(r.at).toLocaleString()}</div>
          </div>
        </div>
        <div className="hstack">{parts.map((p) => <Badge key={p} tone="blue">{p}</Badge>)}</div>
        <p className="footnote secondary" style={{ margin: 0 }}>Replaces this person’s previous input. Checksum {r.sum} verified. Logged to the audit trail.</p>
      </div>
    </Sheet>
  );
}
