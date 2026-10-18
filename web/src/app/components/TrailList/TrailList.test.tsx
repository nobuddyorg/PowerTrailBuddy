// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { arrangeTrails } from '../../lib/ui-logic/trailCards';
import { makeCache, makeCaches, makeTrail, renderWithI18n } from '../fixtures.test-support';
import { TrailList } from '.';

const doubtful = makeTrail({
  id: 'D',
  caches: [
    ...makeCaches(10, 'GCSUD'),
    makeCache({ code: 'GCSUX1', recentLogs: [{ type: 'dnf', date: '2026-01-02' }, { type: 'dnf', date: '2026-01-01' }] }),
    makeCache({ code: 'GCSUX2', recentLogs: [{ type: 'maintenance', date: '2026-01-02' }] }),
    makeCache({ code: 'GCSUX3', recentLogs: [{ type: 'maintenance', date: '2026-01-02' }] }),
    makeCache({ code: 'GCSUX4', available: false }),
  ],
  walkMeters: 4300,
  durationMinutes: 100,
  cachesPerHour: 8.4,
  shape: 'area',
});
const plain = makeTrail({ id: 'P', caches: makeCaches(12, 'GCSUP'), shape: 'line', cachesPerHour: 7.25 });

function renderList(overrides: Partial<Parameters<typeof TrailList>[0]> = {}) {
  const props = {
    cards: arrangeTrails([doubtful, plain], { sort: 'rate', filters: [] }),
    trailCount: 2,
    pending: false,
    sort: 'rate' as const,
    filters: [],
    located: true,
    onSortChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onSelect: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  renderWithI18n(<TrailList {...props} />);
  return props;
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('TrailList', () => {
  it('ranks each trail with its numbers, shape and doubtful caches', () => {
    renderList();
    expect(screen.getByRole('heading', { name: '2 trails' })).toBeInTheDocument();
    const [first, second] = screen.getAllByTestId('trail-card');
    expect(first).toHaveTextContent('Trail #1');
    expect(first).toHaveTextContent('8.4 caches/h');
    expect(first).toHaveTextContent('14 caches · 4.3 km · 1 h 40 min');
    expect(first).toHaveTextContent('Area');
    expect(within(first).getByTestId('trail-health')).toHaveTextContent(
      '1 with recent DNFs · 2 need maintenance · 1 disabled',
    );
    expect(second).toHaveTextContent('Line');
    expect(within(second).queryByTestId('trail-health')).not.toBeInTheDocument();
  });

  it('uses the singular for one of a kind', () => {
    const one = makeTrail({
      caches: [makeCache({ code: 'GCSU1', recentLogs: [{ type: 'maintenance', date: '2026-01-02' }] })],
    });
    renderList({ cards: arrangeTrails([one], { sort: 'rate', filters: [] }), trailCount: 1 });
    expect(screen.getByRole('heading', { name: '1 trail' })).toBeInTheDocument();
    expect(screen.getByTestId('trail-card')).toHaveTextContent('1 cache ·');
    expect(screen.getByTestId('trail-health')).toHaveTextContent('1 needs maintenance');
  });

  it('shows how far each trail is from the user, when known', () => {
    renderList({ cards: arrangeTrails([plain], { sort: 'rate', filters: [], position: { latitude: 47.5, longitude: 9.4 } }) });
    expect(screen.getByTestId('trail-distance')).toHaveTextContent('7.5 km away');
  });

  it('opens a trail', () => {
    const { onSelect } = renderList();
    fireEvent.click(screen.getAllByTestId('trail-card')[1]);
    expect(onSelect).toHaveBeenCalledWith('P');
  });

  it('changes the sort', () => {
    const { onSortChange } = renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort trails' }), { target: { value: 'shortest' } });
    expect(onSortChange).toHaveBeenCalledWith('shortest');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Best rate',
      'Most caches',
      'Nearest to me',
      'Shortest',
    ]);
  });

  it('turns quick filters on and off', () => {
    const { onFiltersChange } = renderList({ filters: ['quick'] });
    const group = screen.getByRole('group', { name: 'Filter trails' });
    expect(within(group).getByRole('button', { name: '≤ 2 h' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: '≤ 5 km' }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(['quick', 'short']);
    fireEvent.click(within(group).getByRole('button', { name: '≤ 2 h' }));
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it('offers "nearest" and "near me" only with a known position', () => {
    renderList({ located: false });
    expect(screen.getByRole('option', { name: 'Nearest to me' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Near me' })).toBeDisabled();
  });

  it('says when the filters leave nothing', () => {
    renderList({ cards: [] });
    expect(screen.getByText('No trail matches these filters.')).toBeInTheDocument();
  });

  it('says how to get trails when the settings find none', () => {
    const { onOpenSettings } = renderList({ cards: [], trailCount: 0 });
    expect(screen.getByRole('heading', { name: '0 trails' })).toBeInTheDocument();
    expect(screen.getByText(/No power trails with the current settings/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows that the trails are being recomputed', () => {
    renderList({ cards: [], trailCount: 0, pending: true });
    expect(screen.getByText('Updating…')).toBeInTheDocument();
  });

  it('marks a list being recomputed as busy', () => {
    renderList({ pending: true });
    expect(screen.getByTestId('trail-list')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Updating…')).toBeInTheDocument();
  });
});
