// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../fixtures.test-support';
import { ImportSummary, SUMMARY_MS } from '.';

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ImportSummary', () => {
  it('sums up a clean import in one line and goes by itself', () => {
    const onDismiss = vi.fn();
    renderWithI18n(
      <ImportSummary
        summary={{
          cacheCount: 1,
          files: [{ name: 'pq.zip', cacheCount: 1 }],
          removedCount: 0,
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId('import-summary')).toHaveTextContent(
      'Imported 1 cache from 1 file.',
    );
    expect(screen.queryByTestId('import-file')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(SUMMARY_MS);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('names each refused file with its reason and stays until dismissed', () => {
    const onDismiss = vi.fn();
    renderWithI18n(
      <ImportSummary
        summary={{
          cacheCount: 812,
          files: [
            { name: 'pq.zip', cacheCount: 812 },
            { name: 'notes.txt', cacheCount: 0, error: 'unsupported' },
            { name: 'broken.gpx', cacheCount: 0, error: 'unreadable' },
            { name: 'huge.zip', cacheCount: 0, error: 'too-large' },
          ],
          removedCount: 0,
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId('import-summary')).toHaveTextContent(
      'Imported 812 caches from 4 files.',
    );
    expect(
      screen.getAllByTestId('import-file').map((item) => item.textContent),
    ).toEqual([
      'notes.txt: not a geocache .zip or .gpx file',
      'broken.gpx: the file is damaged and could not be read',
      'huge.zip: too large (more than 50 files or 100 MB unpacked, or more than 20,000 caches in one import)',
    ]);
    act(() => {
      vi.advanceTimersByTime(SUMMARY_MS * 2);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('says how many caches a query imported again no longer lists', () => {
    const { rerender } = renderWithI18n(
      <ImportSummary
        summary={{
          cacheCount: 40,
          files: [{ name: 'pq.zip', cacheCount: 40 }],
          removedCount: 3,
        }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('import-removed')).toHaveTextContent(
      'Removed 3 caches the queries no longer list.',
    );
    rerender(
      <ImportSummary
        summary={{
          cacheCount: 40,
          files: [{ name: 'pq.zip', cacheCount: 40 }],
          removedCount: 1,
        }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('import-removed')).toHaveTextContent(
      'Removed 1 cache the query no longer lists.',
    );
  });

  it('says nothing of removed caches when none went', () => {
    renderWithI18n(
      <ImportSummary
        summary={{
          cacheCount: 40,
          files: [{ name: 'pq.zip', cacheCount: 40 }],
          removedCount: 0,
        }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('import-removed')).not.toBeInTheDocument();
  });
});
