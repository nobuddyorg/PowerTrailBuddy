import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  cycleSnap,
  draggedFraction,
  nearestSnap,
  SNAP_FRACTION,
  stepSnap,
} from './sheet';

describe('nearestSnap', () => {
  it.each([
    [0, 'peek'],
    [0.39, 'peek'],
    [0.4, 'half'],
    [0.73, 'half'],
    [0.74, 'full'],
    [1, 'full'],
  ])('settles %s of the screen at %s', (fraction, expected) => {
    expect(nearestSnap(fraction)).toBe(expected);
  });

  it('settles each snap point on itself', () => {
    for (const [snap, fraction] of Object.entries(SNAP_FRACTION)) {
      expect(nearestSnap(fraction)).toBe(snap);
    }
  });
});

describe('stepSnap and cycleSnap', () => {
  it('steps one point up or down and stops at the ends', () => {
    expect(stepSnap('peek', 'up')).toBe('half');
    expect(stepSnap('half', 'up')).toBe('full');
    expect(stepSnap('full', 'up')).toBe('full');
    expect(stepSnap('full', 'down')).toBe('half');
    expect(stepSnap('half', 'down')).toBe('peek');
    expect(stepSnap('peek', 'down')).toBe('peek');
  });

  it('cycles up and wraps from the top to the bottom', () => {
    expect(cycleSnap('peek')).toBe('half');
    expect(cycleSnap('half')).toBe('full');
    expect(cycleSnap('full')).toBe('peek');
  });
});

describe('draggedFraction', () => {
  it('follows the finger as a share of the viewport', () => {
    expect(
      draggedFraction({
        startFraction: 0.5,
        movedPixels: 100,
        viewportHeight: 1000,
      }),
    ).toBeCloseTo(0.6);
    expect(
      draggedFraction({
        startFraction: 0.5,
        movedPixels: -100,
        viewportHeight: 1000,
      }),
    ).toBeCloseTo(0.4);
  });

  it('stays between the lowest and the highest snap point', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5000, max: 5000 }),
        fc.integer({ min: 200, max: 3000 }),
        (movedPixels, viewportHeight) => {
          const fraction = draggedFraction({
            startFraction: SNAP_FRACTION.half,
            movedPixels,
            viewportHeight,
          });
          expect(fraction).toBeGreaterThanOrEqual(SNAP_FRACTION.peek);
          expect(fraction).toBeLessThanOrEqual(SNAP_FRACTION.full);
        },
      ),
    );
    expect(
      draggedFraction({
        startFraction: 0.5,
        movedPixels: 5000,
        viewportHeight: 1000,
      }),
    ).toBe(SNAP_FRACTION.full);
    expect(
      draggedFraction({
        startFraction: 0.5,
        movedPixels: -5000,
        viewportHeight: 1000,
      }),
    ).toBe(SNAP_FRACTION.peek);
  });
});
