import { describe, expect, it } from 'vitest';
import { toText } from './tasks';
import { extractJSON } from './providers';

describe('live AI output hardening', () => {
  it('unwraps the shapes small models return', () => {
    expect(toText('plain')).toBe('plain');
    expect(toText({ text: 'wrapped' })).toBe('wrapped');
    expect(toText({ 'Performance at 74% makes AX-400 top.': '' })).toBe('Performance at 74% makes AX-400 top.');
    expect(toText(['a', { content: 'b' }])).toBe('a b');
    expect(toText(null)).toBe('');
  });
  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJSON('Sure!\n```json\n{"ok": true}\n```')).toEqual({ ok: true });
    expect(extractJSON('Here you go {"a": {"b": 1}} thanks')).toEqual({ a: { b: 1 } });
    expect(() => extractJSON('no json here')).toThrow();
  });
});
