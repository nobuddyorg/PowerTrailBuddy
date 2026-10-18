// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCache, makeCaches, makeTrail, renderWithProviders } from '../fixtures.test-support';
import { downloadFile } from '../ui/download';
import { TrailDetail } from '.';

vi.mock('../ui/download', () => ({ downloadFile: vi.fn() }));

const caches = makeCaches(4, 'GCSUT').map((cache, index) => ({
  ...cache,
  parking: index === 3 ? { latitude: 47.5, longitude: 9.51 } : index === 0 ? { latitude: 47.49, longitude: 9.5 } : undefined,
}));
const TRAIL = makeTrail({
  id: 'T',
  caches,
  walkMeters: 4290,
  durationMinutes: 100,
  cachesPerHour: 7.2,
  shape: 'line',
});

function renderDetail(overrides: Partial<Parameters<typeof TrailDetail>[0]> = {}) {
  const props = {
    trail: TRAIL,
    rank: 2,
    onBack: vi.fn(),
    onStartWalk: vi.fn(),
    onOpenCache: vi.fn(),
    ...overrides,
  };
  return { ...renderWithProviders(<TrailDetail {...props} />), props };
}

const rows = () => screen.getAllByTestId('trail-cache');

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  vi.mocked(downloadFile).mockClear();
});

describe('TrailDetail', () => {
  it('sums the trail up', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Trail #2' })).toBeInTheDocument();
    const stats = screen.getByRole('article');
    for (const [label, value] of [
      ['Caches', '4'],
      ['Pace', '7.2 caches/h'],
      ['Walk', '4.3 km'],
      ['Time', '1 h 40 min'],
      ['Shape', 'Line'],
    ]) {
      expect(within(stats).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.queryByText('From you')).not.toBeInTheDocument();
    expect(screen.queryByText(/look doubtful/)).not.toBeInTheDocument();
  });

  it('lists the caches in walking order and goes back', () => {
    const { props } = renderDetail();
    expect(rows().map((row) => within(row).getAllByText(/Row stop/)[0].textContent)).toEqual([
      'Row stop 1',
      'Row stop 2',
      'Row stop 3',
      'Row stop 4',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('starts the walk forwards, or reversed when the order was turned', () => {
    const { props } = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Start walk' }));
    expect(props.onStartWalk).toHaveBeenLastCalledWith({ reversed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(screen.getByRole('button', { name: 'Reverse' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(rows()[0]).getByText('Row stop 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start walk' }));
    expect(props.onStartWalk).toHaveBeenLastCalledWith({ reversed: true });
  });

  it('offers to start at the end nearest the user, saying how far it is', () => {
    const { props } = renderDetail({ position: { latitude: 47.5, longitude: 9.507 } });
    expect(within(screen.getByRole('article')).getByText('From you').nextElementSibling).toHaveTextContent('75 m');
    fireEvent.click(screen.getByRole('button', { name: 'Start at the nearest end (75 m away)' }));
    expect(props.onStartWalk).toHaveBeenCalledWith({ fromCode: 'GCSUT4' });
  });

  it('points to the parking nearest the start, which turns with the order', () => {
    renderDetail();
    const parking = screen.getByTestId('trail-parking');
    expect(parking).toHaveAttribute('href', 'geo:47.490000,9.500000?q=47.490000,9.500000(Parking%2C%20trail%20%232)');
    expect(parking).toHaveTextContent('N 47° 29.400′ E 009° 30.000′');
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(screen.getByTestId('trail-parking')).toHaveTextContent('N 47° 30.000′ E 009° 30.600′');
  });

  it('has no parking entry when the caches list none', () => {
    renderDetail({ trail: makeTrail({ caches: makeCaches(3) }) });
    expect(screen.queryByTestId('trail-parking')).not.toBeInTheDocument();
  });

  it('warns about doubtful caches', () => {
    const trail = makeTrail({
      caches: [...makeCaches(3), makeCache({ code: 'GCSUZ', available: false })],
    });
    renderDetail({ trail });
    expect(screen.getByText(/1 cache looks doubtful/)).toBeInTheDocument();
  });

  it('exports the trail as GPX in the shown order and confirms', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export GPX' }));
    const [{ name, data, type }] = vi.mocked(downloadFile).mock.calls[0];
    expect(name).toBe('powertrail-2.gpx');
    expect(type).toBe('application/gpx+xml');
    const gpx = String(data);
    expect(gpx).toContain('PowerTrailBuddy – Trail #2');
    expect(gpx.indexOf('GCSUT4')).toBeLessThan(gpx.indexOf('GCSUT1'));
    expect(screen.getByTestId('toast')).toHaveTextContent('GPX file saved');
  });

  it('opens a cache row to every action, and shows the cache on the map', () => {
    const { props } = renderDetail({
      trail: makeTrail({
        caches: [makeCache({ code: 'GCSUQ', name: 'Odd one', recentLogs: [{ type: 'maintenance', date: '2026-01-01' }] })],
      }),
    });
    const [row] = rows();
    const toggle = within(row).getByRole('button', { name: /Odd one/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(row).getByRole('link', { name: 'Cache page' })).toBeVisible();
    expect(within(row).getByTestId('health-badge')).toHaveTextContent('Needs maintenance');
    fireEvent.click(within(row).getByRole('button', { name: 'Mark as found' }));
    expect(screen.getByTestId('toast')).toHaveTextContent('GCSUQ marked as found');
    fireEvent.click(within(row).getByRole('button', { name: 'Show on map' }));
    expect(props.onOpenCache).toHaveBeenCalledWith('GCSUQ');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
