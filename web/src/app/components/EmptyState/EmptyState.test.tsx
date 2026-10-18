// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../fixtures.test-support';
import { EmptyState } from '.';

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('EmptyState', () => {
  it('walks through the three steps and links to the Pocket Query page', () => {
    renderWithI18n(<EmptyState importing={false} onImport={() => {}} onTrySample={() => {}} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Create a Pocket Query',
      'Download the .zip',
      'Import it here',
    ]);
    expect(screen.getByRole('link', { name: 'Open Pocket Queries' })).toHaveAttribute(
      'href',
      'https://www.geocaching.com/pocket/',
    );
  });

  it('imports chosen files and loads the sample on request', () => {
    const onImport = vi.fn();
    const onTrySample = vi.fn();
    renderWithI18n(<EmptyState importing={false} onImport={onImport} onTrySample={onTrySample} />);
    const file = new File(['x'], 'pq.zip');
    fireEvent.change(screen.getByLabelText('Import Pocket Query'), { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledWith([file]);
    fireEvent.click(screen.getByRole('button', { name: 'Try with sample data' }));
    expect(onTrySample).toHaveBeenCalledTimes(1);
  });

  it('holds both while an import runs', () => {
    renderWithI18n(<EmptyState importing onImport={() => {}} onTrySample={() => {}} />);
    expect(screen.getByLabelText('Importing…')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Try with sample data' })).toBeDisabled();
  });
});
