// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../fixtures.test-support';
import { SharedImportDialog } from '.';

const FILES = [new File([''], 'pq one.zip'), new File([''], 'pq one.zip')];

function renderDialog() {
  const onImport = vi.fn();
  const onCancel = vi.fn();
  renderWithI18n(
    <SharedImportDialog
      files={FILES}
      onImport={onImport}
      onCancel={onCancel}
    />,
  );
  return { onImport, onCancel };
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('SharedImportDialog', () => {
  it('names every shared file, a repeated name too, and asks before importing', () => {
    renderDialog();
    const dialog = screen.getByRole('alertdialog', {
      name: 'Import the shared files?',
    });
    expect(dialog).toHaveAccessibleDescription(
      /replace any with the same code/,
    );
    expect(
      screen.getAllByTestId('shared-file').map((item) => item.textContent),
    ).toEqual(['pq one.zip', 'pq one.zip']);
  });

  it('imports on Import', () => {
    const { onImport, onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImport).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('drops the share on Cancel, which comes first so Enter never imports by accident', () => {
    const { onImport, onCancel } = renderDialog();
    const [first] = screen
      .getAllByRole('button')
      .filter((button) => button.textContent !== '');
    expect(first).toHaveTextContent('Cancel');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onImport).not.toHaveBeenCalled();
  });
});
