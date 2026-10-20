// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TRAIL_SETTINGS } from '../../lib/trails/types';
import { recordOutcome, startWalk, type WalkState } from '../../lib/walk/walk';
import type { GeolocationState } from '../../useGeolocation';
import {
  makeCache,
  makeCaches,
  makeTrail,
  renderWithProviders,
} from '../fixtures.test-support';
import { mapStub } from '../Map/mapStub.test-support';
import { downloadFile } from '../ui/download';
import { WalkView } from '.';

vi.mock('../Map', () => import('../Map/mapStub.test-support'));
vi.mock('../ui/download', () => ({ downloadFile: vi.fn() }));

const NOW = new Date('2026-06-01T10:30:00Z');
const STARTED = '2026-06-01T10:00:00Z';
const HINTS = ['Under the root', 'In the hedge', ''];
const CACHES = makeCaches(3, 'GCWALK').map((cache, index) => ({
  ...cache,
  hint: HINTS[index],
}));
const OTHER = makeCache({ code: 'GCAWAY', latitude: 47.6 });
const TRAIL = makeTrail({ id: 'walk', caches: CACHES });

const located = (
  longitude: number,
  movement: { gpsHeading: number; speed: number } = {
    gpsHeading: 0,
    speed: 0,
  },
): GeolocationState => ({
  status: 'located',
  position: { latitude: 47.5, longitude },
  accuracyMeters: 6,
  ...movement,
});
// About a hundred metres west of the first cache, and fifteen.
const FAR = located(9.4987);
const NEAR = located(9.4998);

function walkWith(
  outcomes: [string, 'found' | 'dnf' | 'skipped', string][] = [],
): WalkState {
  return outcomes.reduce(
    (walk, [code, outcome, at]) => recordOutcome(walk, code, outcome, at),
    startWalk(TRAIL, STARTED),
  );
}

function renderWalk(overrides: Partial<Parameters<typeof WalkView>[0]> = {}) {
  const props = {
    walk: walkWith(),
    caches: [...CACHES, OTHER],
    settings: DEFAULT_TRAIL_SETTINGS,
    location: FAR,
    startLocation: vi.fn(),
    showOtherCaches: true,
    onToggleOtherCaches: vi.fn(),
    onRecord: vi.fn(),
    onUndo: vi.fn(),
    onReverse: vi.fn(),
    onEnd: vi.fn(),
    ...overrides,
  };
  const view = renderWithProviders(<WalkView {...props} />);
  return {
    ...view,
    props,
    rerenderWith: (next: Partial<typeof props>) =>
      view.rerender(<WalkView {...props} {...next} />),
  };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const figure = (label: string) => screen.getByText(label).nextElementSibling;

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(downloadFile).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'vibrate');
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'userActivation');
  vi.unstubAllGlobals();
});

describe('guiding to the next cache', () => {
  it('names the target and shows how far and which way, north up without a heading', () => {
    renderWalk();
    const target = screen.getByTestId('walk-target');
    expect(
      within(target).getByRole('heading', { name: 'Row stop 1' }),
    ).toBeInTheDocument();
    expect(within(target).getByText('GCWALK1').parentElement).toHaveTextContent(
      'Next cache · GCWALK1',
    );
    expect(screen.getByTestId('walk-distance')).toHaveTextContent(/^98\s+m$/);
    expect(screen.getByText('east, 90°')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Arrow to the cache, 90° clockwise from north',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('No compass: north is up')).toBeInTheDocument();
    expect(screen.queryByTestId('walk-close')).not.toBeInTheDocument();
  });

  it('turns the arrow by the course while walking', () => {
    renderWalk({ location: located(9.4987, { gpsHeading: 45, speed: 1.4 }) });
    expect(screen.getByTestId('compass-arrow')).toHaveAttribute(
      'data-rotation',
      '45',
    );
    expect(
      screen.getByText('Direction from your movement'),
    ).toBeInTheDocument();
    expect(mapStub.props?.position?.heading).toBe(45);
  });

  it('points relative to the compass where the phone has one', () => {
    vi.stubGlobal(
      'DeviceOrientationEvent',
      function DeviceOrientationEvent() {},
    );
    renderWalk();
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('deviceorientation'), {
          webkitCompassHeading: 30,
        }),
      );
    });
    expect(screen.getByText('Compass')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Arrow to the cache, 60° clockwise from where you face',
      }),
    ).toBeInTheDocument();
  });

  it('explains a missing position', () => {
    const cases: [GeolocationState, RegExp][] = [
      [{ status: 'waiting' }, /Finding your position/],
      [{ status: 'denied' }, /Location access is blocked/],
      [{ status: 'unavailable' }, /not available right now/],
    ];
    for (const [location, text] of cases) {
      const { unmount } = renderWalk({ location });
      expect(screen.getByTestId('walk-location')).toHaveTextContent(text);
      expect(mapStub.props?.position).toBeUndefined();
      unmount();
    }
  });

  it('says when the cache is close and buzzes once for it', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    });
    const { rerenderWith } = renderWalk({ location: NEAR });
    expect(screen.getByTestId('walk-close')).toHaveTextContent("You're close");
    rerenderWith({ location: located(9.4999) });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('offers the hint and the ways to the real cache', () => {
    renderWalk();
    fireEvent.click(button('Show hint'));
    expect(screen.getByText('Under the root')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cache page' })).toHaveAttribute(
      'href',
      'https://coord.info/GCWALK1',
    );
  });

  it("hides the next cache's hint again, whatever was shown for the last one", () => {
    const { rerenderWith } = renderWalk();
    fireEvent.click(button('Show hint'));
    expect(screen.getByText('Under the root')).toBeVisible();
    rerenderWith({
      walk: walkWith([['GCWALK1', 'found', '2026-06-01T10:10:00Z']]),
    });
    expect(screen.getByText('In the hedge')).not.toBeVisible();
    expect(button('Show hint')).toHaveAttribute('aria-expanded', 'false');
  });

  it('turns the arrow the short way when the direction crosses north', () => {
    const walking = (gpsHeading: number) =>
      located(9.4987, { gpsHeading, speed: 1.4 });
    const { rerenderWith } = renderWalk({ location: walking(91) });
    const arrow = screen.getByTestId('compass-arrow');
    expect(arrow).toHaveAttribute('data-rotation', '359');
    rerenderWith({ location: walking(88) });
    expect(arrow).toHaveAttribute('data-rotation', '362');
    expect(arrow.style.transform).toMatch(/^rotate\(36[12]\.\d*deg\)$/);
    expect(
      screen.getByRole('img', {
        name: 'Arrow to the cache, 2° clockwise from where you face',
      }),
    ).toBeInTheDocument();
  });

  it('asks for the compass with a tap where the browser wants one', () => {
    const requestPermission = vi.fn(() => Promise.resolve('denied'));
    vi.stubGlobal(
      'DeviceOrientationEvent',
      Object.assign(function DeviceOrientationEvent() {}, {
        requestPermission,
      }),
    );
    renderWalk();
    fireEvent.click(button('Use the compass'));
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('logging', () => {
  it('records found, not found and skip for the target', () => {
    const { props } = renderWalk();
    fireEvent.click(button('Found'));
    fireEvent.click(button('Not found'));
    fireEvent.click(button('Skip'));
    expect(vi.mocked(props.onRecord).mock.calls).toEqual([
      ['GCWALK1', 'found'],
      ['GCWALK1', 'dnf'],
      ['GCWALK1', 'skipped'],
    ]);
  });

  it('undoes only once something was recorded', () => {
    const { props, rerenderWith } = renderWalk();
    expect(button('Undo')).toBeDisabled();
    rerenderWith({
      walk: walkWith([['GCWALK1', 'found', '2026-06-01T10:10:00Z']]),
    });
    fireEvent.click(button('Undo'));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Row stop 2' }),
    ).toBeInTheDocument();
  });

  it('turns the rest of the walk around', () => {
    const { props } = renderWalk();
    fireEvent.click(button('Reverse the remaining caches'));
    expect(props.onReverse).toHaveBeenCalledTimes(1);
  });
});

describe('live numbers', () => {
  it('counts progress, finds and DNFs, time, pace and time to go', () => {
    renderWalk({
      walk: walkWith([
        ['GCWALK1', 'found', '2026-06-01T10:10:00Z'],
        ['GCWALK2', 'dnf', '2026-06-01T10:20:00Z'],
      ]),
    });
    expect(screen.getByTestId('walk-progress')).toHaveTextContent('2/3');
    expect(
      screen.getByRole('progressbar', { name: 'Walk progress' }),
    ).toHaveAttribute('aria-valuenow', '2');
    expect(figure('Found / DNF')).toHaveTextContent('1 / 1');
    expect(figure('Time')).toHaveTextContent(/^30\s+min$/);
    expect(figure('Per hour')).toHaveTextContent('2.0');
    expect(figure('To go')).toHaveTextContent(/^\d+\s+min$/);
  });

  it('shows no pace in the first minutes', () => {
    vi.setSystemTime(new Date('2026-06-01T10:05:00Z'));
    renderWalk();
    expect(figure('Per hour')).toHaveTextContent('–');
  });
});

describe('the map', () => {
  it('draws the walk with its target and keeps walker and target in view', () => {
    renderWalk();
    const tones = mapStub.props?.content.markers.map((marker) => [
      marker.code,
      marker.tone,
    ]);
    expect(tones).toContainEqual(['GCWALK1', 'target']);
    expect(tones).toContainEqual(['GCAWAY', 'other']);
    expect(mapStub.props?.follow).toHaveLength(2);
    fireEvent.click(button('map pan'));
    expect(mapStub.props?.follow).toEqual([]);
    fireEvent.click(button('Show and follow my position'));
    expect(mapStub.props?.follow).toHaveLength(2);
  });

  it('leaves out the other caches on request', () => {
    const { props } = renderWalk({ showOtherCaches: false });
    expect(
      mapStub.props?.content.markers.map((marker) => marker.code),
    ).not.toContain('GCAWAY');
    fireEvent.click(button('Show caches outside trails'));
    expect(props.onToggleOtherCaches).toHaveBeenCalledTimes(1);
  });

  it('skips a code with no cache behind it', () => {
    renderWalk({ caches: CACHES.slice(1) });
    const tones = mapStub.props?.content.markers.map((marker) => [
      marker.code,
      marker.tone,
    ]);
    expect(tones?.map(([code]) => code).sort()).toEqual(['GCWALK2', 'GCWALK3']);
    expect(tones).toContainEqual(['GCWALK2', 'target']);
  });
});

describe('after a re-import dropped caches of the walk', () => {
  it('goes on with the next cache still imported, and counts only those', () => {
    const { rerenderWith } = renderWalk({
      walk: walkWith([['GCWALK1', 'found', '2026-06-01T10:10:00Z']]),
    });
    expect(screen.getByTestId('walk-target-code')).toHaveTextContent('GCWALK2');

    rerenderWith({ caches: [CACHES[2], OTHER] });

    expect(screen.getByTestId('walk-target-code')).toHaveTextContent('GCWALK3');
    expect(screen.getByTestId('walk-progress')).toHaveTextContent('1/2');
  });

  it('ends with the summary once nothing still imported is open', () => {
    renderWalk({
      walk: walkWith([['GCWALK1', 'found', '2026-06-01T10:10:00Z']]),
      caches: [CACHES[0], OTHER],
    });
    expect(screen.getByTestId('walk-summary')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /resume/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('walk-progress')).toHaveTextContent('1/1');
  });
});

describe('the end of the walk', () => {
  const DONE = walkWith([
    ['GCWALK1', 'found', '2026-06-01T10:10:00Z'],
    ['GCWALK2', 'dnf', '2026-06-01T10:20:00Z'],
    ['GCWALK3', 'skipped', '2026-06-01T10:25:00Z'],
  ]);

  it('sums up a finished walk and exports its field notes', () => {
    renderWalk({ walk: DONE });
    const summary = screen.getByTestId('walk-summary');
    expect(
      within(summary).getByRole('heading', { name: 'Walk complete!' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('walk-summary-text')).toHaveTextContent(
      /^Power trail walk with PowerTrailBuddy: 1 of 3 caches found in 30\s+min \(2\.0 per hour\)\.$/,
    );
    fireEvent.click(button('Export field notes'));
    const [{ name, data, type }] = vi.mocked(downloadFile).mock.calls[0];
    expect(name).toBe('geocache_visits.txt');
    expect(type).toBe('text/plain;charset=utf-16le');
    const text = new TextDecoder('utf-16le').decode(data as Uint8Array);
    expect(text).toContain('GCWALK1,2026-06-01T10:10Z,Found it');
    expect(text).not.toContain('GCWALK3');
    expect(screen.getByTestId('toast')).toHaveTextContent('Field notes saved');
    expect(screen.getByRole('link', { name: 'Upload drafts' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.queryByTestId('walk-target')).not.toBeInTheDocument();
    expect(mapStub.props?.follow).toEqual([]);
  });

  it('shares the summary where the device can, and ends the walk', () => {
    const share = vi.fn(() =>
      Promise.reject(new DOMException('dismissed', 'AbortError')),
    );
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    const { props } = renderWalk({ walk: DONE });
    fireEvent.click(button('Share'));
    expect(share).toHaveBeenCalledWith({
      title: 'PowerTrailBuddy',
      text: expect.stringContaining('1 of 3 caches found') as string,
    });
    fireEvent.click(button('Undo'));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(button('Back to trails'));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it('offers no share without the share sheet, and no export with nothing to log', () => {
    vi.setSystemTime(new Date('2026-06-01T10:05:00Z'));
    renderWalk({
      walk: walkWith(CACHES.map(({ code }) => [code, 'skipped', STARTED])),
    });
    expect(
      screen.queryByRole('button', { name: 'Share' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Export field notes' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('walk-summary-text')).toHaveTextContent(
      /0 of 3 caches found in 5\s+min\.$/,
    );
  });

  it('can be finished early and taken up again', () => {
    renderWalk({
      walk: walkWith([['GCWALK1', 'found', '2026-06-01T10:10:00Z']]),
    });
    fireEvent.click(button('Finish'));
    expect(
      screen.getByRole('heading', { name: 'Walk finished early' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Undo' }),
    ).not.toBeInTheDocument();
    fireEvent.click(button('Resume walk'));
    expect(
      screen.getByRole('heading', { name: 'Row stop 2' }),
    ).toBeInTheDocument();
  });
});

describe('focus', () => {
  const heading = (name: string) => screen.getByRole('heading', { name });

  it('lands on the target when the walk starts, and on the summary when it ends', () => {
    renderWalk();
    expect(heading('Row stop 1')).toHaveFocus();
    fireEvent.click(button('Finish'));
    expect(heading('Walk finished early')).toHaveFocus();
    fireEvent.click(button('Resume walk'));
    expect(heading('Row stop 1')).toHaveFocus();
  });

  it('stays on Found while the next target comes up', () => {
    const { rerenderWith } = renderWalk();
    button('Found').focus();
    rerenderWith({
      walk: walkWith([['GCWALK1', 'found', '2026-06-01T10:10:00Z']]),
    });
    expect(heading('Row stop 2')).not.toHaveFocus();
    expect(button('Found')).toHaveFocus();
  });

  it('is left alone when a walk is resumed on page load, before any tap', () => {
    Object.defineProperty(navigator, 'userActivation', {
      value: { hasBeenActive: false },
      configurable: true,
    });
    renderWalk();
    expect(heading('Row stop 1')).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});
