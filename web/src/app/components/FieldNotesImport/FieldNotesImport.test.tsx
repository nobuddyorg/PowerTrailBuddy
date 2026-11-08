// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../fixtures.test-support';
import { downloadFile } from '../ui/download';
import { FieldNotesImport } from '.';

vi.mock('../ui/download', () => ({ downloadFile: vi.fn() }));

function utf16(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(2 + 2 * text.length);
  bytes.set([0xff, 0xfe]);
  [...text].forEach((unit, index) => {
    bytes[2 + 2 * index] = unit.charCodeAt(0) & 0xff;
    bytes[3 + 2 * index] = unit.charCodeAt(0) >> 8;
  });
  return bytes;
}

function load(...files: File[]) {
  fireEvent.change(screen.getByTestId('field-notes-input'), {
    target: { files },
  });
}

const TWO_VISITS =
  'GC0FN1,2026-06-01T10:10Z,Found it,""\r\n' +
  'GC0FN2,2026-06-01T10:20Z,Didn\'t find it,""\r\n';

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  vi.mocked(downloadFile).mockClear();
});

describe('FieldNotesImport', () => {
  it('offers the drafts upload before anything is loaded', () => {
    renderWithProviders(<FieldNotesImport />);
    expect(screen.getByRole('link', { name: 'Upload drafts' })).toHaveAttribute(
      'href',
      'https://www.geocaching.com/my/uploadfieldnotes.aspx',
    );
    expect(screen.queryByTestId('field-notes-read')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('loads saved field notes and saves them again with a log text on every visit', async () => {
    renderWithProviders(<FieldNotesImport />);
    load(new File([utf16(TWO_VISITS)], 'geocache_visits.txt'));
    expect(await screen.findByTestId('field-notes-read')).toHaveTextContent(
      '2 visits read.',
    );

    fireEvent.change(screen.getByLabelText(/Log text for every cache/), {
      target: { value: 'TFTC' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export field notes' }));

    const [{ name, data }] = vi.mocked(downloadFile).mock.calls[0];
    expect(name).toBe('geocache_visits.txt');
    expect(new TextDecoder('utf-16le').decode(data as Uint8Array)).toBe(
      'GC0FN1,2026-06-01T10:10Z,Found it,"TFTC"\r\n' +
        'GC0FN2,2026-06-01T10:20Z,Didn\'t find it,"TFTC"\r\n',
    );
  });

  it('counts a single visit in the singular', async () => {
    renderWithProviders(<FieldNotesImport />);
    load(
      new File([utf16('GC0FN1,2026-06-01T10:10Z,Found it,""\r\n')], 'one.txt'),
    );
    expect(await screen.findByTestId('field-notes-read')).toHaveTextContent(
      '1 visit read.',
    );
  });

  it('says a file is not field notes, and offers no export for it', async () => {
    renderWithProviders(<FieldNotesImport />);
    load(new File(['bread, milk'], 'shopping-list.txt'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This is not a field notes file (geocache_visits.txt).',
    );
    expect(
      screen.queryByRole('button', { name: 'Export field notes' }),
    ).not.toBeInTheDocument();
  });

  it('names the line that is not a visit', async () => {
    renderWithProviders(<FieldNotesImport />);
    load(
      new File(
        [utf16('GC0FN1,2026-06-01T10:10Z,Found it,""\r\nnonsense\r\n')],
        'bad.txt',
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Line 2 is not a “Found it” or “Didn’t find it” entry.',
    );
  });

  it('drops the visits and the error of an earlier file when the next one is read', async () => {
    renderWithProviders(<FieldNotesImport />);
    load(new File([utf16(TWO_VISITS)], 'good.txt'));
    await screen.findByTestId('field-notes-read');

    load(new File(['bread, milk'], 'bad.txt'));
    await screen.findByRole('alert');
    expect(screen.queryByTestId('field-notes-read')).not.toBeInTheDocument();

    load(new File([utf16(TWO_VISITS)], 'good.txt'));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('field-notes-read')).toBeInTheDocument();
  });

  it('ignores a picker that was cancelled', () => {
    renderWithProviders(<FieldNotesImport />);
    load();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-notes-read')).not.toBeInTheDocument();
  });
});
