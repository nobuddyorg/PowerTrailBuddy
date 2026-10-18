'use client';

import { useCallback } from 'react';

import { saveLocallyFound, saveWalk } from './data/store';
import type { Trail } from './lib/trails/types';
import {
  orientWalk,
  recordOutcome,
  reverseWalk,
  startWalk,
  undoLast,
  type WalkOutcome,
  type WalkState,
} from './lib/walk/walk';
import type { DataCore } from './useAppState';

export interface WalkStart {
  /** Walk the trail backwards. */
  reversed?: boolean;
  /** Begin at this end of the trail, e.g. the one nearest to the user. */
  fromCode?: string;
}

const now = () => new Date().toISOString();

/** The guided walk: start, record, undo, turn around, end; a find also marks the cache found for every trail. */
export function useWalkActions({ current, update, persist }: DataCore) {
  const setWalk = useCallback(
    (walk: WalkState | undefined) => {
      update({ walk });
      persist(saveWalk(walk));
    },
    [persist, update],
  );

  const setFound = useCallback(
    (code: string, found: boolean) => {
      const locallyFound = new Set(current().locallyFound);
      if (found) locallyFound.add(code);
      else locallyFound.delete(code);
      update({ locallyFound });
      persist(saveLocallyFound(locallyFound));
    },
    [current, persist, update],
  );

  const begin = useCallback(
    (trail: Trail, { reversed = false, fromCode }: WalkStart = {}) => {
      let walk = startWalk(trail, now());
      if (reversed) walk = reverseWalk(walk);
      if (fromCode) walk = orientWalk(walk, fromCode);
      setWalk(walk);
    },
    [setWalk],
  );

  const record = useCallback(
    (code: string, outcome: WalkOutcome) => {
      const walk = current().walk;
      if (!walk) return;
      setWalk(recordOutcome(walk, code, outcome, now()));
      if (outcome === 'found') setFound(code, true);
    },
    [current, setFound, setWalk],
  );

  const undo = useCallback(() => {
    const walk = current().walk;
    const code = walk?.history.at(-1);
    if (!walk || code === undefined) return;
    const undone = walk.outcomes[code].outcome;
    setWalk(undoLast(walk));
    if (undone === 'found') setFound(code, false);
  }, [current, setFound, setWalk]);

  const reverse = useCallback(() => {
    const walk = current().walk;
    if (walk) setWalk(reverseWalk(walk));
  }, [current, setWalk]);

  return {
    startWalk: begin,
    recordOutcome: record,
    undoOutcome: undo,
    reverseWalk: reverse,
    endWalk: useCallback(() => setWalk(undefined), [setWalk]),
  };
}
