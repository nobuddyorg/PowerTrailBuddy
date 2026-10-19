import type { Trail } from '../trails/types';

export type WalkOutcome = 'found' | 'dnf' | 'skipped';

interface RecordedOutcome {
  outcome: WalkOutcome;
  /** ISO date-time. */
  at: string;
}

export interface WalkState {
  trailId: string;
  /** Walking order; orientWalk and reverseWalk move the caches with an outcome to the front. */
  codes: string[];
  /** ISO date-time. */
  startedAt: string;
  outcomes: Record<string, RecordedOutcome>;
  /** Codes with an outcome, oldest record first; the last is what undo takes back. */
  history: string[];
}

export interface WalkProgress {
  done: number;
  total: number;
  found: number;
  dnf: number;
}

export interface WalkPace {
  elapsedMinutes: number;
  /** Finds per hour so far; 0 before any time has passed. */
  cachesPerHour: number;
}

const MILLISECONDS_PER_MINUTE = 60_000;

function hasOutcome(state: WalkState, code: string): boolean {
  return Object.hasOwn(state.outcomes, code);
}

/** Keeps the done codes in front and rearranges only the open ones. */
function withOpenCodes(
  state: WalkState,
  rearrange: (open: string[]) => string[],
): WalkState {
  const done = state.codes.filter((code) => hasOutcome(state, code));
  const open = state.codes.filter((code) => !hasOutcome(state, code));
  return { ...state, codes: [...done, ...rearrange(open)] };
}

export function startWalk(trail: Trail, at: string): WalkState {
  return {
    trailId: trail.id,
    codes: trail.caches.map((cache) => cache.code),
    startedAt: at,
    outcomes: {},
    history: [],
  };
}

/** Reversed when `code` is the last open cache, else rotated (a round trip starts anywhere); unknown codes change nothing. */
export function orientWalk(state: WalkState, code: string): WalkState {
  return withOpenCodes(state, (open) => {
    const index = open.indexOf(code);
    if (index === -1) return open;
    if (index === open.length - 1) return [...open].reverse();
    return [...open.slice(index), ...open.slice(0, index)];
  });
}

/** Walks the open caches in the opposite direction. */
export function reverseWalk(state: WalkState): WalkState {
  return withOpenCodes(state, (open) => [...open].reverse());
}

/** Pure: returns a new state; a later outcome replaces an earlier one, and a code outside the walk is ignored. */
export function recordOutcome(
  state: WalkState,
  code: string,
  outcome: WalkOutcome,
  at: string,
): WalkState {
  if (!state.codes.includes(code)) return state;
  return {
    ...state,
    outcomes: { ...state.outcomes, [code]: { outcome, at } },
    history: [...state.history.filter((each) => each !== code), code],
  };
}

/** Takes back the most recent outcome; the cache becomes open again where it stands. */
export function undoLast(state: WalkState): WalkState {
  const code = state.history.at(-1);
  if (code === undefined) return state;
  const outcomes = Object.fromEntries(
    Object.entries(state.outcomes).filter(([each]) => each !== code),
  );
  return { ...state, outcomes, history: state.history.slice(0, -1) };
}

/** Without the open caches `present` lacks, as after a re-import dropped them; recorded ones stay, and one that comes back is walked again. */
export function withoutMissingCaches(
  state: WalkState,
  present: ReadonlySet<string>,
): WalkState {
  return {
    ...state,
    codes: state.codes.filter(
      (code) => hasOutcome(state, code) || present.has(code),
    ),
  };
}

/** The first code without an outcome; undefined once the walk is done. */
export function nextCode(state: WalkState): string | undefined {
  return state.codes.find((code) => !hasOutcome(state, code));
}

function countOutcome(state: WalkState, outcome: WalkOutcome): number {
  return state.codes.filter(
    (code) =>
      hasOutcome(state, code) && state.outcomes[code].outcome === outcome,
  ).length;
}

export function walkProgress(state: WalkState): WalkProgress {
  return {
    done: state.codes.filter((code) => hasOutcome(state, code)).length,
    total: state.codes.length,
    found: countOutcome(state, 'found'),
    dnf: countOutcome(state, 'dnf'),
  };
}

/** Time since the start and finds per hour, at `now` (ISO date-time); a clock before the start counts as no time. */
export function walkPace(state: WalkState, now: string): WalkPace {
  const elapsedMilliseconds = Date.parse(now) - Date.parse(state.startedAt);
  // NaN, from an unreadable time, counts as no time.
  const elapsedMinutes = Math.max(
    0,
    elapsedMilliseconds / MILLISECONDS_PER_MINUTE || 0,
  );
  const found = countOutcome(state, 'found');
  return {
    elapsedMinutes,
    cachesPerHour: elapsedMinutes > 0 ? (found * 60) / elapsedMinutes : 0,
  };
}
