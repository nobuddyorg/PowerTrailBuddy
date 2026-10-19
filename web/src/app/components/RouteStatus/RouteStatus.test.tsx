// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RouteCheck } from '../../useWalkingDistances';
import { renderWithI18n } from '../fixtures.test-support';
import { RouteStatus } from '.';

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('RouteStatus', () => {
  it('shows nothing while walking routes are off', () => {
    renderWithI18n(<RouteStatus check={{ status: 'off' }} />);
    expect(screen.queryByTestId('route-status')).toBeNull();
  });

  it.each<[RouteCheck, string]>([
    [
      { status: 'checking', remaining: 3 },
      'Checking walking routes … (3 requests left)',
    ],
    [
      { status: 'checking', remaining: 1 },
      'Checking walking routes … (1 request left)',
    ],
    [{ status: 'done' }, 'Distances follow real footpaths.'],
    [
      { status: 'limited' },
      'Walking routes are checked for some trails only; the rest are estimated. Reload to check more.',
    ],
    [
      { status: 'failed' },
      "Walking routes couldn't be checked; distances are estimated.",
    ],
  ])('says how far the check is: %j', (check, text) => {
    renderWithI18n(<RouteStatus check={check} />);
    expect(screen.getByTestId('route-status-text').textContent).toBe(text);
    expect(screen.getByTestId('route-status-text').dataset.status).toBe(
      check.status,
    );
  });

  it("credits the routing server and links to OpenStreetMap's fix-the-map page", () => {
    renderWithI18n(<RouteStatus check={{ status: 'done' }} />);
    expect(screen.getByTestId('route-status').textContent).toContain(
      'Walking routes: FOSSGIS routing, map data © OpenStreetMap contributors',
    );
    const link = screen.getByRole('link', { name: 'Fix the map' });
    expect(link.getAttribute('href')).toBe(
      'https://www.openstreetmap.org/fixthemap',
    );
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
