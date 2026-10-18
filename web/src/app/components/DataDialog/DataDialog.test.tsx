// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../fixtures.test-support';
import { DataDialog } from '.';

function renderDialog(overrides: Partial<Parameters<typeof DataDialog>[0]> = {}) {
  const props = {
    cacheCount: 812,
    trailCount: 4,
    locallyFoundCount: 3,
    ignoredCount: 1,
    importInfo: { at: '2026-05-01T08:00:00Z', cacheCount: 812, fileNames: ['pq.zip', 'extra.gpx'] },
    importing: false,
    onImport: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithI18n(<DataDialog {...props} />);
  return props;
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('DataDialog', () => {
  it('counts what is stored and names the last import', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Your data' });
    for (const [label, value] of [
      ['Imported caches', '812'],
      ['Trails', '4'],
      ['Marked found here', '3'],
      ['Ignored', '1'],
    ]) {
      expect(within(dialog).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.getByTestId('last-import')).toHaveTextContent('2026');
    expect(screen.getByText('pq.zip, extra.gpx')).toBeInTheDocument();
  });

  it('leaves out the last import before there was one', () => {
    renderDialog({ importInfo: undefined });
    expect(screen.queryByTestId('last-import')).not.toBeInTheDocument();
  });

  it('imports more files', () => {
    const { onImport } = renderDialog();
    const file = new File(['x'], 'more.zip');
    fireEvent.change(screen.getByLabelText('Import more'), { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledWith([file]);
  });

  it('shows a running import', () => {
    renderDialog({ importing: true });
    expect(screen.getByLabelText('Importing…')).toBeDisabled();
  });

  it('clears everything only after confirming', () => {
    const { onClear } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Clear all data?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    fireEvent.click(screen.getByTestId('confirm-accept'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('closes', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
