'use client';

import { useCallback } from 'react';

import { updateIgnored, updateLocallyFound } from './data/store';
import type { DataCore } from './dataCore';

type CodesChange = (codes: ReadonlySet<string>) => Set<string>;

const withCode =
  (code: string): CodesChange =>
  (codes) =>
    new Set(codes).add(code);

const withoutCode =
  (code: string): CodesChange =>
  (codes) => {
    const next = new Set(codes);
    next.delete(code);
    return next;
  };

const noCodes: CodesChange = () => new Set();

/** Marking caches found or ignored here, which takes them out of every trail, and taking that back. */
export function useMarkActions({ current, update, persist }: DataCore) {
  // The stored codes get the same change rather than this window's copy, which another open window may have outdated.
  const changeLocallyFound = useCallback(
    (change: CodesChange) => {
      update({ locallyFound: change(current().locallyFound) });
      persist(updateLocallyFound(change));
    },
    [current, persist, update],
  );

  const changeIgnored = useCallback(
    (change: CodesChange) => {
      update({ ignored: change(current().ignored) });
      persist(updateIgnored(change));
    },
    [current, persist, update],
  );

  return {
    markFound: useCallback(
      (code: string) => changeLocallyFound(withCode(code)),
      [changeLocallyFound],
    ),
    unmarkFound: useCallback(
      (code: string) => changeLocallyFound(withoutCode(code)),
      [changeLocallyFound],
    ),
    resetLocallyFound: useCallback(
      () => changeLocallyFound(noCodes),
      [changeLocallyFound],
    ),
    ignore: useCallback(
      (code: string) => changeIgnored(withCode(code)),
      [changeIgnored],
    ),
    unignore: useCallback(
      (code: string) => changeIgnored(withoutCode(code)),
      [changeIgnored],
    ),
  };
}
