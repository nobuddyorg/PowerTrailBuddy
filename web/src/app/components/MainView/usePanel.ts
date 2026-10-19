'use client';

import { useCallback, useState } from 'react';

export type PanelView =
  | { kind: 'list' }
  | { kind: 'trail'; trailId: string }
  | { kind: 'cache'; code: string };

const LIST: PanelView = { kind: 'list' };

/** One string per view; the card or row that opens a view carries it as `data-focus-key`, for Back to return focus to. */
export function viewKey(view: PanelView): string {
  if (view.kind === 'trail') return `trail:${view.trailId}`;
  if (view.kind === 'cache') return `cache:${view.code}`;
  return 'list';
}

interface PanelState {
  stack: PanelView[];
  /** The key of the view Back just left, '' after anything else. */
  returnFocus: string;
}

/** What the side panel or bottom sheet shows, with a back stack: list → trail → cache. */
export function usePanel() {
  const [{ stack, returnFocus }, setState] = useState<PanelState>({
    stack: [LIST],
    returnFocus: '',
  });
  const view = stack[stack.length - 1];

  const open = useCallback((next: PanelView) => {
    setState((current) => {
      const top = current.stack[current.stack.length - 1];
      if (viewKey(top) === viewKey(next)) return current;
      // Another trail or cache replaces the one shown rather than piling up behind it.
      const below =
        top.kind === next.kind ? current.stack.slice(0, -1) : current.stack;
      return { stack: [...below, next], returnFocus: '' };
    });
  }, []);

  const back = useCallback(
    () =>
      setState((current) =>
        current.stack.length > 1
          ? {
              stack: current.stack.slice(0, -1),
              returnFocus: viewKey(current.stack[current.stack.length - 1]),
            }
          : current,
      ),
    [],
  );
  // Straight above the list, back is the way to every trail rather than to another view.
  return { view, backToList: stack.length === 2, returnFocus, open, back };
}
