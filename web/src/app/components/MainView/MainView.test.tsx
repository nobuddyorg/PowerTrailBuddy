// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCES } from '../../data/store';
import type { Trail } from '../../lib/trails/types';
import type { GeolocationState } from '../../useGeolocation';
import type { RouteCheck } from '../../useWalkingDistances';
import {
  makeApp,
  makeCache,
  makeCaches,
  makeTrail,
  renderWithProviders,
} from '../fixtures.test-support';
import { mapStub } from '../Map/mapStub.test-support';
import { MainView } from '.';

vi.mock('../Map', () => import('../Map/mapStub.test-support'));

const FIRST = makeTrail({ id: 'first', caches: makeCaches(3, 'GCONE') });
const SECOND = makeTrail({
  id: 'second',
  caches: makeCaches(3, 'GCTWO').map((cache) => ({
    ...cache,
    latitude: 47.6,
  })),
  cachesPerHour: 5,
  walkMeters: 6000,
});
const LONER = makeCache({
  code: 'GCLONE',
  name: 'Lonely Stump',
  latitude: 47.7,
});
const CACHES = [...FIRST.caches, ...SECOND.caches, LONER];
const LOCATED: GeolocationState = {
  status: 'located',
  position: { latitude: 47.5, longitude: 9.5 },
  accuracyMeters: 8,
  gpsHeading: 45,
  speed: 1.5,
};

function setWide(wide: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: wide && query === '(min-width: 1024px)',
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function renderMain({
  trails = [FIRST, SECOND],
  location = { status: 'idle' },
  app = makeApp({ caches: CACHES }),
}: {
  trails?: Trail[];
  location?: GeolocationState;
  app?: ReturnType<typeof makeApp>;
} = {}) {
  const props = {
    app,
    trails,
    pending: false,
    routeCheck: { status: 'off' } as RouteCheck,
    location,
    startLocation: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  const view = renderWithProviders(<MainView {...props} />);
  return {
    ...view,
    props,
    rerenderWith: (next: Partial<typeof props>) =>
      view.rerender(<MainView {...props} {...next} />),
  };
}

const tap = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));
const tones = () =>
  mapStub.props?.content.markers.map((marker) => [marker.code, marker.tone]);

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  setWide(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MainView', () => {
  it('lists the trails in a bottom sheet over the map on a phone', () => {
    renderMain();
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).getAllByTestId('trail-card')).toHaveLength(2);
    expect(within(sheet).getByTestId('cache-count')).toHaveTextContent(
      '7 caches imported',
    );
    expect(screen.queryByTestId('side-panel')).not.toBeInTheDocument();
    expect(mapStub.props?.coveredBottom).toBeGreaterThan(0);
  });

  it('puts the list in a side panel on a wide screen', () => {
    setWide(true);
    renderMain();
    expect(
      within(screen.getByTestId('side-panel')).getAllByTestId('trail-card'),
    ).toHaveLength(2);
    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument();
    expect(mapStub.props?.coveredBottom).toBe(0);
  });

  it('frames every trail at first, and the caches when no trail was found', () => {
    renderMain();
    expect(mapStub.props?.frame?.points).toHaveLength(6);
    renderMain({ trails: [] });
    expect(mapStub.props?.frame?.points).toHaveLength(7);
  });

  it('frames the trails once when the first search finishes after the first paint', () => {
    const { rerenderWith } = renderMain({ trails: [] });
    const before = mapStub.props?.frame?.id ?? 0;
    rerenderWith({ trails: [FIRST] });
    expect(mapStub.props?.frame?.id).toBe(before + 1);
    expect(mapStub.props?.frame?.points).toEqual(FIRST.caches);
    rerenderWith({ trails: [FIRST, SECOND] });
    expect(mapStub.props?.frame?.id).toBe(before + 1);
  });

  it('opens a trail from its card, emphasises it on the map, and goes back', () => {
    renderMain();
    fireEvent.click(screen.getAllByTestId('trail-card')[1]);
    expect(
      screen.getByRole('heading', { name: 'Trail #2' }),
    ).toBeInTheDocument();
    expect(mapStub.props?.frame?.points).toEqual(SECOND.caches);
    expect(
      mapStub.props?.content.lines.find((line) => line.trailId === 'second')
        ?.tone,
    ).toBe('selected');
    expect(
      mapStub.props?.content.lines.find((line) => line.trailId === 'first')
        ?.tone,
    ).toBe('faded');
    tap('Back');
    expect(screen.getAllByTestId('trail-card')).toHaveLength(2);
  });

  it('opens a trail tapped on the map and starts its walk', () => {
    const { props } = renderMain();
    tap('map trail first');
    tap('Start walk');
    expect(props.app.startWalk).toHaveBeenCalledWith(FIRST, {
      reversed: false,
    });
  });

  it('opens a cache tapped on the map, with the way to its trail', () => {
    renderMain();
    tap('map cache GCONE2');
    expect(
      screen.getByRole('heading', { name: 'Row stop 2' }),
    ).toBeInTheDocument();
    expect(tones()).toContainEqual(['GCONE2', 'target']);
    tap('All trails');
    expect(screen.getAllByTestId('trail-card')).toHaveLength(2);
  });

  it('goes back from a cache to the trail it was opened from', () => {
    renderMain();
    tap('map trail second');
    tap('map cache GCLONE');
    expect(
      screen.getByRole('heading', { name: 'Lonely Stump' }),
    ).toBeInTheDocument();
    tap('map cache GCTWO1');
    tap('Back');
    expect(
      screen.getByRole('heading', { name: 'Trail #2' }),
    ).toBeInTheDocument();
  });

  it('finds a cache by name in the search and shows it', () => {
    renderMain();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a cache' }), {
      target: { value: 'lonely' },
    });
    fireEvent.click(screen.getByTestId('search-result'));
    expect(
      screen.getByRole('heading', { name: 'Lonely Stump' }),
    ).toBeInTheDocument();
    expect(mapStub.props?.frame?.points).toEqual([LONER]);
  });

  it('ignores a selection that matches nothing', () => {
    renderMain();
    mapStub.props?.onSelectTrail?.('gone');
    mapStub.props?.onSelectCache?.('GCNONE');
    expect(screen.getAllByTestId('trail-card')).toHaveLength(2);
  });

  it('says so when the trail or cache shown has gone, and goes back', () => {
    const app = makeApp({ caches: CACHES });
    const { rerenderWith } = renderMain({ app });
    tap('map trail first');
    rerenderWith({ trails: [SECOND] });
    expect(screen.getByText(/no longer here/)).toBeInTheDocument();
    tap('Back');
    tap('map cache GCLONE');
    rerenderWith({ app: { ...app, caches: FIRST.caches } });
    expect(screen.getByText(/no longer here/)).toBeInTheDocument();
  });

  it('sorts and filters the cards, keeping the sort as a preference', () => {
    const { props } = renderMain();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort trails' }), {
      target: { value: 'caches' },
    });
    expect(props.app.setPreferences).toHaveBeenCalledWith({ sort: 'caches' });
    tap('≤ 5 km');
    expect(screen.getAllByTestId('trail-card')).toHaveLength(1);
  });

  it('opens the settings from a list without trails', () => {
    const { props } = renderMain({ trails: [] });
    tap('Open settings');
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows the position with its course, follows it on locate, and stops when the map is panned', () => {
    const { props } = renderMain({ location: LOCATED });
    expect(mapStub.props?.position).toEqual({
      coordinates: LOCATED.status === 'located' && LOCATED.position,
      accuracyMeters: 8,
      heading: 45,
    });
    expect(screen.getAllByTestId('trail-distance')).toHaveLength(2);
    const locate = screen.getByRole('button', {
      name: 'Show and follow my position',
    });
    fireEvent.click(locate);
    expect(props.startLocation).toHaveBeenCalledTimes(1);
    expect(locate).toHaveAttribute('aria-pressed', 'true');
    expect(mapStub.props?.follow).toHaveLength(1);
    tap('map pan');
    expect(locate).toHaveAttribute('aria-pressed', 'false');
    expect(mapStub.props?.follow).toEqual([]);
  });

  it('draws no course for a position standing still', () => {
    renderMain({ location: { ...LOCATED, speed: 0 } });
    expect(mapStub.props?.position?.heading).toBeUndefined();
  });

  it('shows or hides the caches outside any trail', () => {
    const { props } = renderMain();
    expect(tones()).toContainEqual(['GCLONE', 'other']);
    tap('Show caches outside trails');
    expect(props.app.setPreferences).toHaveBeenCalledWith({
      showOtherCaches: false,
    });
    renderMain({
      app: makeApp({
        caches: CACHES,
        preferences: { ...DEFAULT_PREFERENCES, showOtherCaches: false },
      }),
    });
    expect(tones()?.map(([code]) => code)).not.toContain('GCLONE');
  });

  it('raises the sheet from its peek to show what was picked', () => {
    renderMain();
    const handle = screen.getByTestId('sheet-handle');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute(
      'data-snap',
      'peek',
    );
    tap('map trail first');
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute(
      'data-snap',
      'half',
    );
    fireEvent.keyDown(handle, { key: 'End' });
    tap('map trail second');
    expect(screen.getByTestId('bottom-sheet')).toHaveAttribute(
      'data-snap',
      'full',
    );
  });
});
