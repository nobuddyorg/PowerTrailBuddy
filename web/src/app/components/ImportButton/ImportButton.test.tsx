// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ImportButton } from '.';

describe('ImportButton', () => {
  it('hands over the chosen files and clears itself so the same file can be chosen again', () => {
    const onFiles = vi.fn();
    render(<ImportButton label="Import" onFiles={onFiles} disabled={false} />);
    const input = screen.getByLabelText('Import');
    const file = new File(['<gpx/>'], 'pq.gpx');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('accepts Pocket Query archives and GPX files, several at once', () => {
    render(<ImportButton label="Import" onFiles={() => {}} disabled={false} />);
    const input = screen.getByLabelText('Import');
    expect(input).toHaveAttribute('accept', '.zip,.gpx,application/zip,application/x-zip-compressed,application/gpx+xml');
    expect(input).toHaveAttribute('multiple');
  });

  it('can be disabled while an import runs', () => {
    render(<ImportButton label="Importing" onFiles={() => {}} disabled variant="secondary" />);
    expect(screen.getByLabelText('Importing')).toBeDisabled();
  });
});
