'use client';

import { useCallback } from 'react';

import { saveIgnored, saveLocallyFound } from './data/store';
import type { DataCore } from './useAppState';

function withCode(codes: ReadonlySet<string>, code: string): Set<string> {
  return new Set(codes).add(code);
}

function withoutCode(codes: ReadonlySet<string>, code: string): Set<string> {
  const next = new Set(codes);
  next.delete(code);
  return next;
}

/** Marking caches found or ignored here, which takes them out of every trail, and taking that back. */
export function useMarkActions({ current, update, persist }: DataCore) {
  const setLocallyFound = useCallback(
    (locallyFound: ReadonlySet<string>) => {
      update({ locallyFound });
      persist(saveLocallyFound(locallyFound));
    },
    [persist, update],
  );

  const setIgnored = useCallback(
    (ignored: ReadonlySet<string>) => {
      update({ ignored });
      persist(saveIgnored(ignored));
    },
    [persist, update],
  );

  return {
    markFound: useCallback(
      (code: string) => setLocallyFound(withCode(current().locallyFound, code)),
      [current, setLocallyFound],
    ),
    unmarkFound: useCallback(
      (code: string) =>
        setLocallyFound(withoutCode(current().locallyFound, code)),
      [current, setLocallyFound],
    ),
    resetLocallyFound: useCallback(
      () => setLocallyFound(new Set()),
      [setLocallyFound],
    ),
    ignore: useCallback(
      (code: string) => setIgnored(withCode(current().ignored, code)),
      [current, setIgnored],
    ),
    unignore: useCallback(
      (code: string) => setIgnored(withoutCode(current().ignored, code)),
      [current, setIgnored],
    ),
  };
}
