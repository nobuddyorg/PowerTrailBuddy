import { describe, expect, it } from 'vitest';

import { syntheticCache } from './gpx.test-support';
import { cacheHealth, type CacheHealth } from './health';
import { recentLogsOf } from './recentLogs';
import type { RecentLogType } from './types';

function healthOf(types: RecentLogType[], available = true): CacheHealth {
  const recentLogs = types.map((type, index) => ({
    type,
    date: `2001-01-0${9 - index}`,
  }));
  return cacheHealth(syntheticCache(1, { recentLogs, available }));
}

describe('cacheHealth', () => {
  const cases: [RecentLogType[], CacheHealth][] = [
    [[], 'ok'],
    [['found'], 'ok'],
    [['dnf'], 'ok'],
    [['dnf', 'found'], 'ok'],
    [['found', 'dnf', 'dnf'], 'ok'],
    [['dnf', 'note', 'dnf'], 'ok'],
    [['dnf', 'dnf'], 'dnf-streak'],
    [['dnf', 'dnf', 'found'], 'dnf-streak'],
    [['maintenance'], 'needs-maintenance'],
    [['maintenance', 'dnf'], 'needs-maintenance'],
    [['found', 'maintenance'], 'ok'],
    [['other', 'maintenance'], 'ok'],
    [['disabled'], 'ok'],
    [['note', 'note'], 'ok'],
  ];
  for (const [types, health] of cases) {
    it(`reads the logs [${types.join(', ')}] of an available cache as ${health}`, () => {
      expect(healthOf(types)).toBe(health);
    });
  }

  for (const types of [
    [],
    ['found'],
    ['dnf', 'dnf'],
    ['maintenance'],
  ] as RecentLogType[][]) {
    it(`reads a disabled cache with logs [${types.join(', ')}] as disabled`, () => {
      expect(healthOf(types, false)).toBe('disabled');
    });
  }
});

// The log types as a Pocket Query writes them, newest first, through the same mapping the parser uses.
describe('cacheHealth from the log types of a Pocket Query', () => {
  function healthAfter(types: string[]): CacheHealth {
    const recentLogs = recentLogsOf(
      types.map((type) => ({ type, date: '2001-01-01' })),
    );
    return cacheHealth(syntheticCache(1, { recentLogs }));
  }

  const cases: [string[], CacheHealth][] = [
    [['Needs Maintenance', 'Found it'], 'needs-maintenance'],
    [['Needs Archived', 'Found it'], 'needs-maintenance'],
    [['Owner Maintenance', 'Needs Maintenance'], 'ok'],
    [['Enable Listing', 'Temporarily Disable Listing'], 'ok'],
    [['Update Coordinates', "Didn't find it", "Didn't find it"], 'ok'],
    [['Post Reviewer Note', 'Needs Maintenance'], 'ok'],
    [["Didn't find it", "Didn't find it", 'Owner Maintenance'], 'dnf-streak'],
    [['Webcam Photo Taken', "Didn't find it"], 'ok'],
    [['Attended', "Didn't find it"], 'ok'],
  ];
  for (const [types, health] of cases) {
    it(`reads ${types.join(', ')} as ${health}`, () => {
      expect(healthAfter(types)).toBe(health);
    });
  }
});
