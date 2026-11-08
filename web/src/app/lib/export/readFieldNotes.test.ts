import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildFieldNotes, type FieldNoteEntry } from './fieldNotes';
import { readFieldNotes } from './readFieldNotes';

function fileOf(text: string): Uint8Array {
  return Uint8Array.from(
    ('﻿' + text)
      .split('')
      .flatMap((unit) => [unit.charCodeAt(0) & 0xff, unit.charCodeAt(0) >> 8]),
  );
}

describe('readFieldNotes', () => {
  it('reads the visits of a drafts file, whatever log text they carry', () => {
    expect(
      readFieldNotes(
        fileOf(
          'GC0FN1,2001-02-03T04:05Z,Found it,"TFTC, thanks"\r\n' +
            'GC0FN2,2001-02-03T04:15Z,Didn\'t find it,""\r\n',
        ),
      ),
    ).toEqual({
      entries: [
        { code: 'GC0FN1', outcome: 'found', at: '2001-02-03T04:05Z' },
        { code: 'GC0FN2', outcome: 'dnf', at: '2001-02-03T04:15Z' },
      ],
    });
  });

  it('accepts lines ended by a bare line feed and skips blank lines', () => {
    expect(
      readFieldNotes(
        fileOf(
          'GC0FN1,2001-02-03T04:05Z,Found it,""\n\nGC0FN2,2001-02-03T04:15Z,Found it,""',
        ),
      ),
    ).toMatchObject({
      entries: [{ code: 'GC0FN1' }, { code: 'GC0FN2' }],
    });
  });

  it('refuses a file without the little-endian byte order mark', () => {
    for (const bytes of [
      new TextEncoder().encode('GC0FN1,2001-02-03T04:05Z,Found it,""\r\n'),
      Uint8Array.from([0xfe, 0xff, 0x00, 0x47]),
      Uint8Array.of(),
      Uint8Array.of(0xff),
    ]) {
      expect(readFieldNotes(bytes)).toEqual({
        problem: 'not-field-notes',
        line: 0,
      });
    }
  });

  it('refuses a file that is not valid UTF-16', () => {
    expect(
      readFieldNotes(Uint8Array.from([0xff, 0xfe, 0x00, 0xd8, 0x41, 0x00])),
    ).toEqual({ problem: 'not-field-notes', line: 0 });
  });

  it('refuses a file without a single visit', () => {
    for (const text of ['', '\r\n\r\n']) {
      expect(readFieldNotes(fileOf(text))).toEqual({
        problem: 'not-field-notes',
        line: 0,
      });
    }
  });

  it("names the first line that is not a Found it or Didn't find it entry", () => {
    expect(
      readFieldNotes(
        fileOf(
          'GC0FN1,2001-02-03T04:05Z,Found it,""\r\n' +
            '\r\n' +
            'GC0FN2,2001-02-03T04:15Z,Write note,"hello"\r\n' +
            'nonsense\r\n',
        ),
      ),
    ).toEqual({ problem: 'bad-line', line: 3 });
  });

  it.each([
    ['a lowercase code', 'gc0fn1,2001-02-03T04:05Z,Found it,""'],
    ['a code not from geocaching.com', 'AB0FN1,2001-02-03T04:05Z,Found it,""'],
    ['a code with a trailing part', 'GC0FN1x!,2001-02-03T04:05Z,Found it,""'],
    ['a time with seconds', 'GC0FN1,2001-02-03T04:05:06Z,Found it,""'],
    ['a time without the Z', 'GC0FN1,2001-02-03T04:05,Found it,""'],
    ['a month that does not exist', 'GC0FN1,2001-13-03T04:05Z,Found it,""'],
    ['an unknown log type', 'GC0FN1,2001-02-03T04:05Z,Archive,""'],
    ['a log text without quotes', 'GC0FN1,2001-02-03T04:05Z,Found it,hello'],
    ['a log text left open', 'GC0FN1,2001-02-03T04:05Z,Found it,"hello'],
    ['something before the code', ' GC0FN1,2001-02-03T04:05Z,Found it,""'],
  ])('refuses %s', (_name, line) => {
    expect(readFieldNotes(fileOf(line))).toEqual({
      problem: 'bad-line',
      line: 1,
    });
  });

  it('reads back what buildFieldNotes wrote, oldest first, to the minute', () => {
    const entry = fc.record({
      code: fc.stringMatching(/^GC[0-9A-Z]{1,6}$/),
      outcome: fc.constantFrom<FieldNoteEntry['outcome']>('found', 'dnf'),
      at: fc
        .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2099, 0, 1) })
        .map((time) => new Date(time).toISOString()),
    });
    fc.assert(
      fc.property(
        fc.array(entry, { minLength: 1, maxLength: 10 }),
        fc.string(),
        (entries, message) => {
          const written = [...entries]
            .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
            .map((each) => ({
              ...each,
              at: `${new Date(each.at).toISOString().slice(0, 16)}Z`,
            }));
          expect(readFieldNotes(buildFieldNotes(entries, message))).toEqual({
            entries: written,
          });
        },
      ),
    );
  });
});
