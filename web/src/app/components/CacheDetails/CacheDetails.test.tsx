// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TRAIL_SETTINGS } from '../../lib/trails/types';
import {
  makeCache,
  makeMarks,
  makeTrail,
  renderWithProviders,
} from '../fixtures.test-support';
import { CacheDetails } from '.';
import type { Membership } from './TrailMembership';

const CACHE = makeCache({
  code: 'GCSU42',
  name: '<i>Old Oak</i>',
  placedBy: 'Nobody Real',
  container: 'Small',
  difficulty: 1.5,
  terrain: 2,
  hint: 'Under the root',
  latitude: 48.13538,
  longitude: 11.57612,
  recentLogs: [
    { type: 'dnf', date: '2026-05-02' },
    { type: 'dnf', date: '2026-05-01' },
    { type: 'found', date: '2026-04-20' },
    { type: 'note', date: '2026-04-10' },
    { type: 'maintenance', date: '2026-04-01' },
  ],
});

function renderDetails(
  overrides: Partial<Parameters<typeof CacheDetails>[0]> = {},
  marks = makeMarks(),
) {
  const callbacks = {
    onOpenTrail: vi.fn(),
    onStartWalkHere: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  const view = renderWithProviders(
    <CacheDetails
      cache={CACHE}
      membership={leftOut([])}
      {...callbacks}
      {...overrides}
    />,
    { marks },
  );
  return { ...view, ...callbacks };
}

function leftOut(
  reasons: Extract<Membership, { kind: 'left-out' }>['reasons'],
) {
  return {
    kind: 'left-out',
    reasons,
    settings: DEFAULT_TRAIL_SETTINGS,
  } satisfies Membership;
}

const reasonLines = () =>
  screen.getAllByTestId('left-out-reason').map((line) => line.textContent);

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('CacheDetails', () => {
  it('shows the imported name as text, with code, type, rating, size and owner', () => {
    renderDetails();
    expect(
      screen.getByRole('heading', { name: '<i>Old Oak</i>' }),
    ).toBeInTheDocument();
    expect(screen.getByText('GCSU42')).toBeInTheDocument();
    for (const fact of [
      'Traditional',
      'D 1.5 / T 2',
      'Size: Small',
      'by Nobody Real',
    ]) {
      expect(screen.getByText(fact)).toBeInTheDocument();
    }
  });

  it('leaves the owner out when the file names none', () => {
    renderDetails({ cache: { ...CACHE, placedBy: '' } });
    expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
  });

  it('warns about a DNF streak', () => {
    renderDetails();
    expect(screen.getByTestId('health-badge')).toHaveTextContent('Recent DNFs');
  });

  it.each([
    [{ available: false }, 'Disabled'],
    [
      { recentLogs: [{ type: 'maintenance' as const, date: '2026-05-01' }] },
      'Needs maintenance',
    ],
  ])('names the doubtful health of %o', (overrides, label) => {
    renderDetails({ cache: { ...CACHE, ...overrides } });
    expect(screen.getByTestId('health-badge')).toHaveTextContent(label);
  });

  it('shows no badge for a healthy cache', () => {
    renderDetails({ cache: { ...CACHE, recentLogs: [] } });
    expect(screen.queryByTestId('health-badge')).not.toBeInTheDocument();
    expect(screen.getByText('No logs in the file.')).toBeInTheDocument();
  });

  it('lists the latest logs with their kind for screen readers and their date', () => {
    renderDetails({
      cache: {
        ...CACHE,
        recentLogs: [
          { type: 'disabled', date: '2026-05-02' },
          { type: 'other', date: '2026-05-01' },
        ],
      },
    });
    const logs = screen.getAllByTestId('recent-log');
    expect(logs.map((log) => log.textContent)).toEqual([
      'DisabledMay 2, 2026',
      'Other logMay 1, 2026',
    ]);
  });

  it('names every log kind', () => {
    renderDetails();
    const list = screen.getByRole('list', { name: 'Latest logs' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      "Didn't find itMay 2, 2026",
      "Didn't find itMay 1, 2026",
      'Found itApr 20, 2026',
      'NoteApr 10, 2026',
      'Needs maintenanceApr 1, 2026',
    ]);
  });

  it('keeps the hint hidden until asked, and hides it again', () => {
    renderDetails();
    const hint = screen.getByTestId('hint');
    expect(hint).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Show hint' }));
    expect(hint).toBeVisible();
    expect(hint).toHaveTextContent('Under the root');
    fireEvent.click(screen.getByRole('button', { name: 'Hide hint' }));
    expect(hint).not.toBeVisible();
  });

  it('says so when there is no hint', () => {
    renderDetails({ cache: { ...CACHE, hint: '' } });
    expect(screen.getByText('No hint.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show hint' }),
    ).not.toBeInTheDocument();
  });

  it('links to the listing, a navigation app and walking directions', () => {
    renderDetails();
    expect(screen.getByRole('link', { name: 'Cache page' })).toHaveAttribute(
      'href',
      'https://coord.info/GCSU42',
    );
    expect(screen.getByRole('link', { name: 'Navigate' })).toHaveAttribute(
      'href',
      'geo:48.135380,11.576120?q=48.135380,11.576120(GCSU42%20%3Ci%3EOld%20Oak%3C%2Fi%3E)',
    );
    expect(screen.getByRole('link', { name: 'Walk there' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=48.135380,11.576120&travelmode=walking',
    );
  });

  it('navigates with Apple Maps on an iPhone, which opens no geo: link', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    );
    renderDetails();
    expect(screen.getByRole('link', { name: 'Navigate' })).toHaveAttribute(
      'href',
      'https://maps.apple.com/?ll=48.135380,11.576120&q=GCSU42%20%3Ci%3EOld%20Oak%3C%2Fi%3E',
    );
  });

  it('hides the hint again for the next cache shown in its place', () => {
    const { rerender, ...callbacks } = renderDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Show hint' }));
    expect(screen.getByTestId('hint')).toBeVisible();
    rerender(
      <CacheDetails
        cache={{ ...CACHE, code: 'GCSU43', hint: 'Behind the gate' }}
        membership={leftOut([])}
        onOpenTrail={callbacks.onOpenTrail}
        onStartWalkHere={callbacks.onStartWalkHere}
        onOpenSettings={callbacks.onOpenSettings}
      />,
    );
    expect(screen.getByText('Behind the gate')).not.toBeVisible();
  });

  it('copies the coordinates as geocachers write them and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    renderDetails();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Copy coordinates N 48° 08.123′ E 011° 34.567′',
        }),
      );
    });
    expect(writeText).toHaveBeenCalledWith('N 48° 08.123′ E 011° 34.567′');
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Copied: N 48° 08.123′ E 011° 34.567′',
    );
  });

  it('says so when the browser has no clipboard, outside a secure context', async () => {
    renderDetails();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy coordinates/ }));
    });
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Copying is not allowed here.',
    );
  });

  it('says so when the browser refuses to copy', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('no')));
    renderDetails();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy coordinates/ }));
    });
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Copying is not allowed here.',
    );
  });

  it('shows how far and which way the cache is from the user', () => {
    renderDetails({ position: { latitude: 48.13538, longitude: 11.56612 } });
    expect(screen.getByTestId('cache-distance')).toHaveTextContent(
      '740 m away, to the east',
    );
  });
});

describe('the trail of a cache', () => {
  const TRAIL = makeTrail({ id: 'T1' });

  it('opens the trail the cache belongs to', () => {
    const { onOpenTrail } = renderDetails({
      membership: { kind: 'on-trail', trail: TRAIL, rank: 3 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Part of trail #3' }));
    expect(onOpenTrail).toHaveBeenCalledWith('T1');
    expect(screen.queryByTestId('cache-left-out')).not.toBeInTheDocument();
  });

  it("starts that trail's walk at this cache", () => {
    const { onStartWalkHere } = renderDetails({
      membership: { kind: 'on-trail', trail: TRAIL, rank: 3 },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Start the walk here' }),
    );
    expect(onStartWalkHere).toHaveBeenCalledWith(TRAIL);
  });

  it('has no trail link and no walk for a cache on no trail', () => {
    renderDetails();
    expect(
      screen.queryByRole('button', { name: /Part of trail/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start the walk here' }),
    ).not.toBeInTheDocument();
  });

  it('passing every filter, blames the trail size and leads to the settings', () => {
    const { onOpenSettings } = renderDetails();
    expect(
      screen.getByRole('heading', { name: 'Not in any trail' }),
    ).toBeInTheDocument();
    expect(reasonLines()).toEqual([
      'It meets your limits, but no walk of at least 10 caches forms around it.',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('names each setting it misses, with the limit', () => {
    renderDetails({
      cache: { ...CACHE, type: 'mystery', difficulty: 3, terrain: 2.5 },
      membership: leftOut(['type', 'difficulty', 'terrain']),
    });
    expect(reasonLines()).toEqual([
      'Mystery is not one of your trail cache types.',
      'Difficulty 3 is above your limit of 2.',
      'Terrain 2.5 is above your limit of 2.',
    ]);
    expect(
      screen.getByRole('button', { name: 'Open settings' }),
    ).toBeInTheDocument();
  });

  it('names its state and marks, which no setting changes', () => {
    renderDetails({
      membership: leftOut(['disabled', 'archived', 'found', 'marked']),
    });
    expect(reasonLines()).toEqual([
      'It is disabled.',
      'It is archived.',
      'The Pocket Query lists it as found.',
      'You marked it as found or ignore it.',
    ]);
    expect(
      screen.queryByRole('button', { name: 'Open settings' }),
    ).not.toBeInTheDocument();
  });
});

describe('marking a cache', () => {
  it('marks it found, confirms, and undoes from the toast', () => {
    const { marks } = renderDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as found' }));
    expect(marks.markFound).toHaveBeenCalledWith('GCSU42');
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'GCSU42 marked as found',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(marks.unmarkFound).toHaveBeenCalledWith('GCSU42');
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('takes back a find marked here', () => {
    const { marks } = renderDetails({}, makeMarks({ found: ['GCSU42'] }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Not found after all' }),
    );
    expect(marks.unmarkFound).toHaveBeenCalledWith('GCSU42');
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'GCSU42 no longer marked as found',
    );
  });

  it('offers no found mark for a cache the Pocket Query already lists as found', () => {
    renderDetails({ cache: { ...CACHE, found: true } });
    expect(
      screen.queryByRole('button', { name: 'Mark as found' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ignore' })).toBeInTheDocument();
  });

  it('ignores it, confirms, and undoes from the toast', () => {
    const { marks } = renderDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }));
    expect(marks.ignore).toHaveBeenCalledWith('GCSU42');
    expect(screen.getByTestId('toast')).toHaveTextContent('GCSU42 ignored');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(marks.unignore).toHaveBeenCalledWith('GCSU42');
  });

  it('lets an ignored cache back in', () => {
    const { marks } = renderDetails({}, makeMarks({ ignored: ['GCSU42'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop ignoring' }));
    expect(marks.unignore).toHaveBeenCalledWith('GCSU42');
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'GCSU42 is back in the trails',
    );
  });
});
