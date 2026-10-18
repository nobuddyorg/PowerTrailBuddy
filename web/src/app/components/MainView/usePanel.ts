'use client';

import { useCallback, useState } from 'react';

export type PanelView =
  | { kind: 'list' }
  | { kind: 'trail'; trailId: string }
  | { kind: 'cache'; code: string };

const LIST: PanelView = { kind: 'list' };

/** What the side panel or bottom sheet shows, with a back stack: list → trail → cache. */
export function usePanel() {
  const [stack, setStack] = useState<PanelView[]>([LIST]);
  const view = stack[stack.length - 1];

  const open = useCallback((next: PanelView) => {
    setStack((current) => {
      const top = current[current.length - 1];
      const same =
        (top.kind === 'trail' &&
          next.kind === 'trail' &&
          top.trailId === next.trailId) ||
        (top.kind === 'cache' &&
          next.kind === 'cache' &&
          top.code === next.code);
      // Another trail or cache replaces the one shown rather than piling up behind it.
      if (same) return current;
      if (top.kind === next.kind) return [...current.slice(0, -1), next];
      return [...current, next];
    });
  }, []);

  const back = useCallback(
    () =>
      setStack((current) =>
        current.length > 1 ? current.slice(0, -1) : current,
      ),
    [],
  );
  // Straight above the list, back is the way to every trail rather than to another view.
  return { view, backToList: stack.length === 2, open, back };
}
