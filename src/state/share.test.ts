import { describe, expect, it, beforeAll } from 'vitest';
import { decodeLink, inviteLink, mergeResponse, responseLink, stateFromInvite, type ResponsePack } from './share';
import { initialState, preparedState } from './store';

beforeAll(() => {
  (globalThis as any).location = { origin: 'https://example.test', pathname: '/concord-ahp/' };
});

const d = (url: string) => url.split('?d=')[1];

describe('email collaboration links', () => {
  it('round-trips an invite into a working colleague state', async () => {
    const pm = preparedState(initialState());
    const url = await inviteLink(pm, 'ram', { name: 'Jordan', email: 'j@x.mil' });
    const inv = await decodeLink(d(url));
    expect(inv.t).toBe('invite');
    const mine = stateFromInvite(inv as any, initialState());
    expect(mine.persona).toBe('ram');
    expect(mine.hierarchy).toBe('approved');
    expect(Object.values(mine.evidence).every((c) => c.status === 'verified')).toBe(true);
    expect(mine.evidence['B:mtbf'].quote).toContain('Demonstrated MTBF 3,100 h');
    expect(url.length).toBeLessThan(4000);
  });

  it('sends back only the role’s own input and merges it', async () => {
    const colleague = preparedState(initialState());
    colleague.judgments.ops = colleague.judgments.pm.slice();
    const { url, parts } = await responseLink(colleague, 'ops', { name: 'Kai', email: 'k@x.mil' });
    expect(parts).toEqual(['21 criteria comparisons']);
    expect(url.length).toBeLessThan(1800);
    const r = (await decodeLink(d(url))) as ResponsePack;
    const merged = mergeResponse(initialState(), r);
    expect(merged.judgments.ops).toEqual(colleague.judgments.pm);
    expect(merged.judgments.ram).toEqual(initialState().judgments.ram);
  });

  it('rejects a tampered response', async () => {
    const { url } = await responseLink(preparedState(initialState()), 'ops', { name: 'Kai', email: 'k@x.mil' });
    const r = (await decodeLink(d(url))) as ResponsePack;
    const { inviteLink: _i, ...mod } = await import('./share');
    void _i;
    // Re-encode with a changed judgment but the old checksum.
    const bad = { ...r, c: { ...r.c, judgments: r.c.judgments!.map(() => 9) } };
    const enc = await (async () => {
      const stream = new Blob([JSON.stringify(bad)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    })();
    await expect(mod.decodeLink(enc)).rejects.toThrow(/checksum/);
  });
});
