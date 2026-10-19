import { describe, expect, it } from 'vitest';

import {
  cacheTypeLabel,
  directionName,
  healthLabel,
  logTypeLabel,
  type Translate,
} from './labels';

// Echoes the key, so each test reads which translation a value maps to.
const t = ((key: string) => key) as Translate;

describe('labels', () => {
  it.each([
    ['N', 'direction.N'],
    ['NE', 'direction.NE'],
    ['E', 'direction.E'],
    ['SE', 'direction.SE'],
    ['S', 'direction.S'],
    ['SW', 'direction.SW'],
    ['W', 'direction.W'],
    ['NW', 'direction.NW'],
  ] as const)('names direction %s', (point, key) => {
    expect(directionName(t, point)).toBe(key);
  });

  it.each([
    ['found', 'log.found'],
    ['dnf', 'log.dnf'],
    ['note', 'log.note'],
    ['maintenance', 'log.maintenance'],
    ['disabled', 'log.disabled'],
    ['other', 'log.other'],
  ] as const)('names log type %s', (type, key) => {
    expect(logTypeLabel(t, type)).toBe(key);
  });

  it.each([
    ['disabled', 'health.disabled'],
    ['dnf-streak', 'health.dnfStreak'],
    ['needs-maintenance', 'health.needsMaintenance'],
  ] as const)('names health %s', (health, key) => {
    expect(healthLabel(t, health)).toBe(key);
  });

  it.each([
    ['traditional', 'cacheType.traditional'],
    ['multi', 'cacheType.multi'],
    ['mystery', 'cacheType.mystery'],
    ['letterbox', 'cacheType.letterbox'],
    ['wherigo', 'cacheType.wherigo'],
    ['earthcache', 'cacheType.earthcache'],
    ['virtual', 'cacheType.virtual'],
    ['webcam', 'cacheType.webcam'],
    ['event', 'cacheType.event'],
    ['other', 'cacheType.other'],
  ] as const)('names cache type %s', (type, key) => {
    expect(cacheTypeLabel(t, type)).toBe(key);
  });
});
