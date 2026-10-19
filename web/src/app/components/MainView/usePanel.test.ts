// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePanel, viewKey } from './usePanel';

describe('usePanel', () => {
  it('starts at the list, where back stays', () => {
    const { result } = renderHook(() => usePanel());
    expect(result.current.view).toEqual({ kind: 'list' });
    expect(result.current.backToList).toBe(false);
    act(() => result.current.back());
    expect(result.current.view).toEqual({ kind: 'list' });
  });

  it('stacks list, trail and cache, and walks back through them', () => {
    const { result } = renderHook(() => usePanel());
    act(() => result.current.open({ kind: 'trail', trailId: 'a' }));
    expect(result.current.backToList).toBe(true);
    act(() => result.current.open({ kind: 'cache', code: 'GC1' }));
    expect(result.current.backToList).toBe(false);
    act(() => result.current.back());
    expect(result.current.view).toEqual({ kind: 'trail', trailId: 'a' });
    act(() => result.current.back());
    expect(result.current.view).toEqual({ kind: 'list' });
  });

  it('replaces a trail or cache with another rather than piling them up', () => {
    const { result } = renderHook(() => usePanel());
    act(() => result.current.open({ kind: 'trail', trailId: 'a' }));
    act(() => result.current.open({ kind: 'trail', trailId: 'b' }));
    act(() => result.current.open({ kind: 'cache', code: 'GC1' }));
    act(() => result.current.open({ kind: 'cache', code: 'GC2' }));
    expect(result.current.view).toEqual({ kind: 'cache', code: 'GC2' });
    act(() => result.current.back());
    expect(result.current.view).toEqual({ kind: 'trail', trailId: 'b' });
  });

  it('keeps the same view opened twice as one entry', () => {
    const { result } = renderHook(() => usePanel());
    for (const view of [
      { kind: 'trail', trailId: 'a' },
      { kind: 'trail', trailId: 'a' },
      { kind: 'cache', code: 'GC1' },
      { kind: 'cache', code: 'GC1' },
    ] as const) {
      act(() => result.current.open(view));
    }
    act(() => result.current.back());
    act(() => result.current.back());
    expect(result.current.view).toEqual({ kind: 'list' });
  });

  it('names the view Back left, for focus to return to, until the next open', () => {
    const { result } = renderHook(() => usePanel());
    expect(result.current.returnFocus).toBe('');
    act(() => result.current.open({ kind: 'trail', trailId: 'a' }));
    act(() => result.current.open({ kind: 'cache', code: 'GC1' }));
    expect(result.current.returnFocus).toBe('');
    act(() => result.current.back());
    expect(result.current.returnFocus).toBe('cache:GC1');
    act(() => result.current.back());
    expect(result.current.returnFocus).toBe('trail:a');
    act(() => result.current.open({ kind: 'cache', code: 'GC2' }));
    expect(result.current.returnFocus).toBe('');
  });
});

describe('viewKey', () => {
  it('tells every view apart', () => {
    expect(viewKey({ kind: 'list' })).toBe('list');
    expect(viewKey({ kind: 'trail', trailId: 'a' })).toBe('trail:a');
    expect(viewKey({ kind: 'cache', code: 'a' })).toBe('cache:a');
  });
});
