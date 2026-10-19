import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { makeCache } from '../trails/trails.test-support';
import type { Trail } from '../trails/types';
import {
  nextCode,
  orientWalk,
  recordOutcome,
  reverseWalk,
  startWalk,
  undoLast,
  walkPace,
  walkProgress,
  type WalkOutcome,
  type WalkState,
} from './walk';

const START = '2001-02-03T10:00:00.000Z';

type Command =
  | { kind: 'record'; code: string; outcome: WalkOutcome; minute: number }
  | { kind: 'undo' }
  | { kind: 'orient'; code: string }
  | { kind: 'reverse' };

function trailOf(codes: readonly string[]): Trail {
  return {
    id: `${codes[0]}-${codes.length}`,
    caches: codes.map((code) => makeCache({ code })),
    pathMeters: 1,
    returnMeters: 1,
    walkMeters: 2.6,
    durationMinutes: 1,
    cachesPerHour: 1,
    shape: 'line',
    center: { latitude: 0, longitude: 0 },
  };
}

const codesArbitrary = fc.uniqueArray(fc.stringMatching(/^GC[0-9A-Z]{1,3}$/), {
  minLength: 1,
  maxLength: 8,
});

function commandArbitrary(codes: readonly string[]): fc.Arbitrary<Command> {
  // A code outside the walk exercises the ignore paths.
  const code = fc.constantFrom(...codes, 'GCOUTSIDE');
  return fc.oneof(
    fc.record({
      kind: fc.constant('record' as const),
      code,
      outcome: fc.constantFrom<WalkOutcome>('found', 'dnf', 'skipped'),
      minute: fc.nat({ max: 600 }),
    }),
    fc.constant({ kind: 'undo' as const }),
    fc.record({ kind: fc.constant('orient' as const), code }),
    fc.constant({ kind: 'reverse' as const }),
  );
}

const scenario = codesArbitrary.chain((codes) =>
  fc.tuple(
    fc.constant(codes),
    fc.array(commandArbitrary(codes), { maxLength: 30 }),
  ),
);

function minuteAt(minute: number): string {
  return new Date(Date.parse(START) + minute * 60_000).toISOString();
}

function apply(state: WalkState, command: Command): WalkState {
  switch (command.kind) {
    case 'record':
      return recordOutcome(
        state,
        command.code,
        command.outcome,
        minuteAt(command.minute),
      );
    case 'undo':
      return undoLast(state);
    case 'orient':
      return orientWalk(state, command.code);
    case 'reverse':
      return reverseWalk(state);
  }
}

/** The plain model: the latest outcome per code, and codes in the order last recorded. */
interface Model {
  outcomes: Map<string, WalkOutcome>;
  history: string[];
}

function applyToModel(
  model: Model,
  command: Command,
  codes: readonly string[],
): Model {
  if (command.kind === 'record' && codes.includes(command.code)) {
    const outcomes = new Map(model.outcomes).set(command.code, command.outcome);
    const history = [
      ...model.history.filter((code) => code !== command.code),
      command.code,
    ];
    return { outcomes, history };
  }
  if (command.kind === 'undo' && model.history.length > 0) {
    const last = model.history[model.history.length - 1];
    const outcomes = new Map(model.outcomes);
    outcomes.delete(last);
    return { outcomes, history: model.history.slice(0, -1) };
  }
  return model;
}

function expectInvariants(
  state: WalkState,
  codes: readonly string[],
  model: Model,
): void {
  expect([...state.codes].sort()).toEqual([...codes].sort());
  expect(state.history).toEqual(model.history);
  expect(
    Object.fromEntries(
      Object.entries(state.outcomes).map(([code, { outcome }]) => [
        code,
        outcome,
      ]),
    ),
  ).toEqual(Object.fromEntries(model.outcomes));
  const progress = walkProgress(state);
  expect(progress.done).toBe(model.history.length);
  expect(progress.total).toBe(codes.length);
  expect(progress.found + progress.dnf).toBeLessThanOrEqual(progress.done);
  const next = nextCode(state);
  expect(next === undefined).toBe(progress.done === progress.total);
  if (next !== undefined) {
    expect(model.outcomes.has(next)).toBe(false);
    const before = state.codes.slice(0, state.codes.indexOf(next));
    expect(before.every((code) => model.outcomes.has(code))).toBe(true);
  }
}

describe('walk state machine properties', () => {
  it('matches a plain model of outcomes and undo history after any sequence of actions', () => {
    fc.assert(
      fc.property(scenario, ([codes, commands]) => {
        let state = startWalk(trailOf(codes), START);
        let model: Model = { outcomes: new Map(), history: [] };
        for (const command of commands) {
          state = apply(state, command);
          model = applyToModel(model, command, codes);
          expectInvariants(state, codes, model);
        }
      }),
    );
  });

  it('never changes the state it is given', () => {
    fc.assert(
      fc.property(scenario, ([codes, commands]) => {
        const states = commands.reduce<WalkState[]>(
          (all, command) => [...all, apply(all[all.length - 1], command)],
          [startWalk(trailOf(codes), START)],
        );
        const snapshots = states.map((state) => structuredClone(state));
        for (const [index, command] of commands.entries()) {
          apply(states[index], command);
        }
        expect(states).toEqual(snapshots);
      }),
    );
  });

  it('starts the walk at any open cache it is oriented to, as a rotation or a reversal of the open caches', () => {
    fc.assert(
      fc.property(scenario, fc.nat(), ([codes, commands], pick) => {
        const state = commands.reduce(apply, startWalk(trailOf(codes), START));
        const open = state.codes.filter(
          (code) => !Object.hasOwn(state.outcomes, code),
        );
        fc.pre(open.length > 0);
        const target = open[pick % open.length];
        const oriented = orientWalk(state, target);
        const orientedOpen = oriented.codes.slice(
          oriented.codes.length - open.length,
        );
        expect(nextCode(oriented)).toBe(target);
        const rotations = open.map((_, index) => [
          ...open.slice(index),
          ...open.slice(0, index),
        ]);
        expect([...rotations, [...open].reverse()]).toContainEqual(
          orientedOpen,
        );
      }),
    );
  });

  it('undoes a fresh outcome back to the state before it', () => {
    fc.assert(
      fc.property(scenario, fc.nat(), ([codes, commands], pick) => {
        const state = commands.reduce(apply, startWalk(trailOf(codes), START));
        const open = state.codes.filter(
          (code) => !Object.hasOwn(state.outcomes, code),
        );
        fc.pre(open.length > 0);
        const code = open[pick % open.length];
        expect(undoLast(recordOutcome(state, code, 'found', START))).toEqual(
          state,
        );
      }),
    );
  });

  it('comes back to the same order after reversing twice', () => {
    fc.assert(
      fc.property(scenario, ([codes, commands]) => {
        const state = reverseWalk(
          commands.reduce(apply, startWalk(trailOf(codes), START)),
        );
        expect(reverseWalk(reverseWalk(state))).toEqual(state);
      }),
    );
  });

  it('reports a pace that is never negative and grows with finds', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.integer({ min: -600, max: 600 }),
        ([codes, commands], minute) => {
          const state = commands.reduce(
            apply,
            startWalk(trailOf(codes), START),
          );
          const pace = walkPace(state, minuteAt(minute));
          expect(pace.elapsedMinutes).toBe(Math.max(0, minute));
          const found = walkProgress(state).found;
          expect(pace.cachesPerHour).toBeCloseTo(
            minute > 0 ? (found * 60) / minute : 0,
            9,
          );
        },
      ),
    );
  });
});
