import type { Trail } from '../trails/types';

export type WalkOutcome = 'found' | 'skipped';

export interface WalkState {
  trailId: string;
  codes: string[];
  outcomes: Record<string, WalkOutcome>;
}

export interface WalkProgress {
  done: number;
  total: number;
  found: number;
}

export function startWalk(trail: Trail): WalkState {
  void trail;
  throw new Error('not implemented');
}

/** Pure: returns a new state, never changes the one given. */
export function recordOutcome(
  state: WalkState,
  code: string,
  outcome: WalkOutcome,
): WalkState {
  void state;
  void code;
  void outcome;
  throw new Error('not implemented');
}

/** The first code without an outcome; undefined once the walk is done. */
export function nextCode(state: WalkState): string | undefined {
  void state;
  throw new Error('not implemented');
}

export function walkProgress(state: WalkState): WalkProgress {
  void state;
  throw new Error('not implemented');
}
