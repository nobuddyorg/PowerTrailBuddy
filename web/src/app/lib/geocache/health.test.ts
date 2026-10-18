import { describe, expect, it } from 'vitest';

import { syntheticCache } from './gpx.test-support';
import { cacheHealth, type CacheHealth } from './health';
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
