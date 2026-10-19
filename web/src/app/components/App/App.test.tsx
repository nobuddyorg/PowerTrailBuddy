// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n/I18nProvider';
import { fileOf, gpxOf } from '../../lib/geocache/gpx.test-support';
import { startWalk } from '../../lib/walk/walk';
import {
  memoryIdb,
  storedValue,
  storeValue,
} from '../../memoryIdb.test-support';
import { makeCaches, makeTrail } from '../fixtures.test-support';
import { App } from '.';

vi.mock('idb-keyval', () => import('../../memoryIdb.test-support'));
vi.mock('../Map', () => import('../Map/mapStub.test-support'));
const shared = vi.hoisted(() => ({ files: [] as File[] }));
vi.mock('../../data/sharedFiles', () => ({
  takeSharedFiles: () => Promise.resolve(shared.files),
}));

const SAMPLE_DIR = join(process.cwd(), 'public', 'sample');
// Twelve in a row about 150 m apart: one trail at the default settings.
const CACHES = makeCaches(12, 'GCAPP');

function renderApp() {
  render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}

const watchPosition = vi.fn(() => 1);

const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  shared.files = [];
  window.history.replaceState(null, '', '/');
  localStorage.setItem('lang', 'en');
  memoryIdb.reset();
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('greets a first visit with the guide, after loading', async () => {
    renderApp();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Create a Pocket Query')).toBeInTheDocument();
    expect(screen.getByText('Import Pocket Query')).toBeInTheDocument();
  });

  it('finds trails in the sample data', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      const text = readFileSync(
        join(SAMPLE_DIR, url.split('/').at(-1)!),
        'utf8',
      );
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([text])),
      });
    });
    renderApp();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Try with sample data' }),
    );
    expect(
      (await screen.findAllByTestId('trail-card')).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('import-summary')).toHaveTextContent(
      /from 2 files/,
    );
    fireEvent.click(
      within(screen.getByTestId('import-summary')).getByRole('button', {
        name: 'Dismiss',
      }),
    );
    expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
  });

  it('reports a sample it cannot load, and lets the message go', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    renderApp();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Try with sample data' }),
    );
    expect(
      await screen.findByText(/sample data could not be loaded/),
    ).toBeInTheDocument();
    fireEvent.click(button('Dismiss'));
    expect(
      screen.queryByText(/sample data could not be loaded/),
    ).not.toBeInTheDocument();
  });

  it('imports a picked file from the guide', async () => {
    renderApp();
    const input = await screen.findByTestId('import-input');
    fireEvent.change(input, {
      target: { files: [fileOf(gpxOf(CACHES), 'pq.gpx')] },
    });
    expect(await screen.findByTestId('trail-card')).toBeInTheDocument();
  });

  it('asks before importing a share, and imports it on Import', async () => {
    shared.files = [fileOf(gpxOf(CACHES), 'shared.gpx')];
    window.history.replaceState(null, '', '/?shared=1');
    renderApp();
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Import the shared files?',
    });
    expect(dialog).toHaveTextContent('shared.gpx');
    expect(screen.queryByTestId('trail-card')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByTestId('trail-card')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('imports nothing from a share the user cancels', async () => {
    shared.files = [fileOf(gpxOf(CACHES), 'shared.gpx')];
    window.history.replaceState(null, '', '/?shared=1');
    renderApp();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows the trails in stored data, with settings and data a tap away', async () => {
    storeValue('caches', CACHES);
    storeValue('ignored', ['GCAPP12', 'GCGONE']);
    renderApp();
    expect(await screen.findByTestId('trail-card')).toHaveTextContent(
      '11 caches',
    );

    fireEvent.click(button('Settings'));
    const settings = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(settings).getByText('GCGONE')).toBeInTheDocument();
    fireEvent.change(
      within(settings).getByLabelText('Fewest caches per trail'),
      { target: { value: '20' } },
    );
    fireEvent.click(within(settings).getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByText(/No power trails with the current settings/),
    ).toBeInTheDocument();

    fireEvent.click(button('Open settings'));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('checks walking routes once turned on in the settings, and stops when turned off', async () => {
    const router = vi.fn((url: string) => {
      const size = url.split('/').at(-1)!.split(';').length;
      const distances = Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, column) => (row === column ? 0 : 200)),
      );
      return Promise.resolve(Response.json({ code: 'Ok', distances }));
    });
    vi.stubGlobal('fetch', router);
    storeValue('caches', CACHES);
    renderApp();
    await screen.findByTestId('trail-card');
    expect(screen.queryByTestId('route-status')).not.toBeInTheDocument();

    fireEvent.click(button('Settings'));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Check trails on real footpaths' }),
    );
    fireEvent.click(button('Close'));
    expect(
      await screen.findByText('Distances follow real footpaths.'),
    ).toBeInTheDocument();
    expect(router.mock.calls[0][0]).toMatch(
      /^https:\/\/routing\.openstreetmap\.de\/routed-foot\/table\//,
    );

    fireEvent.click(button('Settings'));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Check trails on real footpaths' }),
    );
    fireEvent.click(button('Close'));
    expect(screen.queryByTestId('route-status')).not.toBeInTheDocument();
  });

  it('forgets the walking routes on Clear all data, even an answer still on its way', async () => {
    let answer = () => {};
    const router = vi.fn(
      (url: string) =>
        new Promise<Response>((resolve) => {
          const size = url.split('/').at(-1)!.split(';').length;
          const distances = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => 200),
          );
          answer = () => resolve(Response.json({ code: 'Ok', distances }));
        }),
    );
    vi.stubGlobal('fetch', router);
    storeValue('caches', CACHES);
    storeValue('preferences', { walkingRoutes: true });
    storeValue('walking-distances', new Map([['GCOLD1|GCOLD2', 150]]));
    renderApp();
    await waitFor(() => expect(router).toHaveBeenCalledTimes(1));

    fireEvent.click(button('Your data'));
    fireEvent.click(button('Clear all data'));
    // The answer is read while the store empties, before the cleared caches reach the screen.
    answer();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Clear data',
      }),
    );
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(storedValue('walking-distances')).toBeUndefined();
  });

  it('merges a further import from the data panel, and clears everything after asking', async () => {
    storeValue('caches', CACHES);
    renderApp();
    await screen.findByTestId('trail-card');
    fireEvent.click(button('Your data'));
    const data = screen.getByTestId('data-dialog');
    fireEvent.change(within(data).getByTestId('import-input'), {
      target: { files: [fileOf(gpxOf(makeCaches(2, 'GCNEW')), 'more.gpx')] },
    });
    expect(await screen.findByTestId('import-summary')).toHaveTextContent(
      /Imported 2 caches/,
    );
    expect(screen.queryByTestId('data-dialog')).not.toBeInTheDocument();

    fireEvent.click(button('Your data'));
    fireEvent.click(button('Clear all data'));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Clear data',
      }),
    );
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    fireEvent.click(button('Your data'));
    fireEvent.click(
      within(screen.getByTestId('data-dialog')).getByRole('button', {
        name: 'Close',
      }),
    );
    expect(screen.queryByTestId('data-dialog')).not.toBeInTheDocument();
  });

  it('resumes a stored walk, asks for the position, and goes back to the trails at the end', async () => {
    storeValue('caches', CACHES);
    storeValue(
      'walk',
      startWalk(makeTrail({ caches: CACHES }), '2026-06-01T10:00:00Z'),
    );
    renderApp();
    expect(await screen.findByTestId('walk-view')).toBeInTheDocument();
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    fireEvent.click(button('Show caches outside trails'));
    fireEvent.click(button('Finish'));
    fireEvent.click(button('Back to trails'));
    expect(await screen.findByTestId('trail-card')).toBeInTheDocument();
  });

  it('starts a walk from a trail', async () => {
    storeValue('caches', CACHES);
    renderApp();
    fireEvent.click(await screen.findByTestId('trail-card'));
    fireEvent.click(button('Start walk'));
    expect(await screen.findByTestId('walk-view')).toBeInTheDocument();
  });

  // The browser makes its offer once, early: the app keeps it until the settings show it.
  it('keeps the install offer for the settings, and spends it there', async () => {
    renderApp();
    await screen.findByTestId('empty-state');
    const prompt = vi.fn().mockResolvedValue(undefined);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt'), { prompt }),
      );
    });
    fireEvent.click(button('Settings'));
    fireEvent.click(button('Install app'));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });

  it('says when the stored data cannot be read', async () => {
    memoryIdb.refuseReads = true;
    renderApp();
    expect(
      await screen.findByText(/stored data could not be read/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
