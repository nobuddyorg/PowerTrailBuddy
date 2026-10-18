import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { MAX_RECENT_LOGS, recentLogsOf } from './recentLogs';
import type { RecentLogType } from './types';

function typeOf(text: string): RecentLogType | undefined {
  return recentLogsOf([{ type: text, date: '2001-02-03' }])[0]?.type;
}

function dateOf(text: string): string | undefined {
  return recentLogsOf([{ type: 'Found it', date: text }])[0]?.date;
}

describe('recentLogsOf: log types', () => {
  const types: [string, RecentLogType][] = [
    ['Found it', 'found'],
    ['FOUND IT', 'found'],
    ['  found it ', 'found'],
    ['Attended', 'found'],
    ['Webcam Photo Taken', 'found'],
    ["Didn't find it", 'dnf'],
    ['Didn’t find it', 'dnf'],
    ['Write note', 'note'],
    ['Needs Maintenance', 'maintenance'],
    ['Needs Archived', 'maintenance'],
    ['Temporarily Disable Listing', 'disabled'],
    ['Owner Maintenance', 'other'],
    ['Enable Listing', 'other'],
    ['Publish Listing', 'other'],
    ['Will Attend', 'other'],
    ['Found', 'other'],
    ['', 'other'],
  ];
  for (const [text, type] of types) {
    it(`maps ${JSON.stringify(text)} to ${type}`, () => {
      expect(typeOf(text)).toBe(type);
    });
  }
});

describe('recentLogsOf: dates', () => {
  const dates: [string, string | undefined][] = [
    ['2001-02-03', '2001-02-03'],
    ['2001-02-03T19:00:00Z', '2001-02-03'],
    ['2001-02-03T00:00:00-08:00', '2001-02-03'],
    [' 2001-02-03T19:00:00 ', '2001-02-03'],
    ['', undefined],
    ['yesterday', undefined],
    ['x2001-02-03', undefined],
    ['2001-02-03x', undefined],
    ['2001-02-03 19:00', undefined],
    ['01-02-03', undefined],
    ['201-02-03', undefined],
    ['2001-2-03', undefined],
    ['2001-02-3', undefined],
    ['2001/02/03', undefined],
    ['20011-02-03', undefined],
    ['2001-022-03', undefined],
    ['2001-02-033', undefined],
    ['abcd-ef-gh', undefined],
    ['03.02.2001', undefined],
  ];
  for (const [text, date] of dates) {
    it(`reads the date ${JSON.stringify(text)} as ${String(date)}`, () => {
      expect(dateOf(text)).toBe(date);
    });
  }

  it('drops a log without a readable date and keeps the rest', () => {
    expect(
      recentLogsOf([
        { type: 'Found it', date: '' },
        { type: 'Write note', date: '2001-02-03' },
      ]),
    ).toEqual([{ type: 'note', date: '2001-02-03' }]);
  });
});

describe('recentLogsOf: order', () => {
  it('puts the newest log first, whatever order the file has', () => {
    expect(
      recentLogsOf([
        { type: 'Found it', date: '2001-01-01' },
        { type: "Didn't find it", date: '2003-01-01' },
        { type: 'Write note', date: '2002-01-01' },
      ]),
    ).toEqual([
      { type: 'dnf', date: '2003-01-01' },
      { type: 'note', date: '2002-01-01' },
      { type: 'found', date: '2001-01-01' },
    ]);
  });

  it('keeps the file order of logs from the same day', () => {
    expect(
      recentLogsOf([
        { type: 'Write note', date: '2001-01-01T10:00:00Z' },
        { type: 'Found it', date: '2001-01-01T09:00:00Z' },
        { type: "Didn't find it", date: '2001-01-01T11:00:00Z' },
      ]).map((log) => log.type),
    ).toEqual(['note', 'found', 'dnf']);
  });

  it('keeps only the five newest logs', () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      type: 'Found it',
      date: `2001-01-0${index + 1}`,
    }));
    expect(recentLogsOf(entries).map((log) => log.date)).toEqual([
      '2001-01-07',
      '2001-01-06',
      '2001-01-05',
      '2001-01-04',
      '2001-01-03',
    ]);
  });

  it('returns no logs for none', () => {
    expect(recentLogsOf([])).toEqual([]);
  });

  it('returns at most five logs, newest first, each from the input', () => {
    const entry = fc.record({
      type: fc.constantFrom('Found it', "Didn't find it", 'Write note', 'x'),
      date: fc
        .integer({ min: 0, max: 36_500 })
        .map((day) => new Date(day * 86_400_000).toISOString()),
    });
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 12 }), (entries) => {
        const logs = recentLogsOf(entries);
        expect(logs.length).toBe(Math.min(MAX_RECENT_LOGS, entries.length));
        const dates = logs.map((log) => log.date);
        expect(dates).toEqual([...dates].sort().reverse());
        const newest = entries
          .map((entry) => entry.date.slice(0, 10))
          .sort()
          .reverse()
          .slice(0, MAX_RECENT_LOGS);
        expect(dates).toEqual(newest);
      }),
    );
  });
});
