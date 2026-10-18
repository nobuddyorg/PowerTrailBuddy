// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
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
import { memoryIdb, storeValue } from '../../memoryIdb.test-support';
import { makeCaches, makeTrail } from '../fixtures.test-support';
import { App } from '.';

vi.mock('idb-keyval', () => import('../../memoryIdb.test-support'));
vi.mock('../Map', () => import('../Map/mapStub.test-support'));
vi.mock('../../data/sharedFiles', () => ({
  takeSharedFiles: () => Promise.resolve([]),
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

  it('says when the stored data cannot be read', async () => {
    memoryIdb.refuseReads = true;
    renderApp();
    expect(
      await screen.findByText(/stored data could not be read/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
