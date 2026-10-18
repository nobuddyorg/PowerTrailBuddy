import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildFieldNotes, type FieldNoteEntry } from './fieldNotes';

function textOf(bytes: Uint8Array): string {
  return new TextDecoder('utf-16le', { ignoreBOM: true }).decode(bytes);
}

describe('buildFieldNotes', () => {
  it('writes one line per entry in the drafts format', () => {
    const text = textOf(
      buildFieldNotes([
        { code: 'GC0FN1', outcome: 'found', at: '2001-02-03T04:05:06.789Z' },
        { code: 'GC0FN2', outcome: 'dnf', at: '2001-02-03T04:15:59.999Z' },
      ]),
    );
    expect(text).toBe(
      '\uFEFFGC0FN1,2001-02-03T04:05Z,Found it,""\r\n' +
        'GC0FN2,2001-02-03T04:15Z,Didn\'t find it,""\r\n',
    );
  });

  it('starts with a little-endian byte order mark and stores two bytes per character', () => {
    const bytes = buildFieldNotes([
      { code: 'GC0FN1', outcome: 'found', at: '2001-02-03T04:05:00Z' },
    ]);
    expect([...bytes.slice(0, 6)]).toEqual([
      0xff, 0xfe, 0x47, 0x00, 0x43, 0x00,
    ]);
    expect(bytes.length).toBe(
      2 * '\uFEFFGC0FN1,2001-02-03T04:05Z,Found it,""\r\n'.length,
    );
  });

  it('encodes characters beyond Latin-1 with their high byte', () => {
    const bytes = buildFieldNotes([
      { code: 'GC\u0141\u20AC', outcome: 'found', at: '2001-02-03T04:05:00Z' },
    ]);
    expect([...bytes.slice(6, 10)]).toEqual([0x41, 0x01, 0xac, 0x20]);
  });

  it('writes the time in UTC, whatever offset it was recorded with', () => {
    const text = textOf(
      buildFieldNotes([
        { code: 'GC0FN1', outcome: 'found', at: '2001-02-03T01:30:00+02:00' },
      ]),
    );
    expect(text).toContain(',2001-02-02T23:30Z,');
  });

  it('sorts the entries oldest first, keeping the given order for the same time', () => {
    const entries: FieldNoteEntry[] = [
      { code: 'GCLATE', outcome: 'found', at: '2001-02-03T12:00:00Z' },
      { code: 'GCEARLY', outcome: 'dnf', at: '2001-02-03T09:00:00+02:00' },
      { code: 'GCSAME1', outcome: 'found', at: '2001-02-03T10:00:00Z' },
      { code: 'GCSAME2', outcome: 'found', at: '2001-02-03T10:00:00Z' },
    ];
    const codes = textOf(buildFieldNotes(entries))
      .slice(1)
      .split('\r\n')
      .map((line) => line.split(',')[0]);
    expect(codes).toEqual(['GCEARLY', 'GCSAME1', 'GCSAME2', 'GCLATE', '']);
  });

  it('writes only the byte order mark for no entries', () => {
    expect([...buildFieldNotes([])]).toEqual([0xff, 0xfe]);
  });

  it('refuses an unreadable time rather than writing a wrong one', () => {
    expect(() =>
      buildFieldNotes([{ code: 'GC0FN1', outcome: 'found', at: 'soon' }]),
    ).toThrow(RangeError);
  });

  it('writes every entry once, in time order, as a decodable line', () => {
    const entry = fc.record({
      code: fc.stringMatching(/^GC[0-9A-Z]{1,6}$/),
      outcome: fc.constantFrom<FieldNoteEntry['outcome']>('found', 'dnf'),
      at: fc
        .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2099, 0, 1) })
        .map((time) => new Date(time).toISOString()),
    });
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 10 }), (entries) => {
        const text = textOf(buildFieldNotes(entries));
        expect(text.startsWith('\uFEFF')).toBe(true);
        const lines = text.slice(1).split('\r\n');
        expect(lines.pop()).toBe('');
        expect(lines.length).toBe(entries.length);
        const minutes = lines.map((line) => line.split(',')[1]);
        expect(minutes).toEqual([...minutes].sort());
        for (const line of lines) {
          expect(line).toMatch(
            /^GC[0-9A-Z]+,\d{4}-\d\d-\d\dT\d\d:\d\dZ,(Found it|Didn't find it),""$/,
          );
        }
        expect(lines.map((line) => line.split(',')[0]).sort()).toEqual(
          entries.map((each) => each.code).sort(),
        );
      }),
    );
  });
});
