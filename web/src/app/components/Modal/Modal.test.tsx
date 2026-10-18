// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../ConfirmDialog';
import { renderWithI18n } from '../fixtures.test-support';
import { Modal } from '.';

function Opener({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <Modal
          title="Dialog"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <input aria-label="First" />
          <button type="button">Last</button>
        </Modal>
      )}
    </>
  );
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('Modal', () => {
  it('moves focus to the first field, traps Tab inside, and closes on Escape back to the opener', () => {
    const onClose = vi.fn();
    renderWithI18n(<Opener onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'open' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Dialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('First')).toHaveFocus();

    screen.getByRole('button', { name: 'Last' }).focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();

    screen.getByLabelText('First').focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByLabelText('First')).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it('closes from its close button', () => {
    const onClose = vi.fn();
    renderWithI18n(<Opener onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('wraps Tab backwards from the first control to the last', () => {
    renderWithI18n(<Opener />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    screen.getByRole('button', { name: 'Close' }).focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('asks with its message, Cancel focused first, and confirms on request', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithI18n(
      <ConfirmDialog title="Clear?" message="All gone." confirmLabel="Clear" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Clear?' });
    expect(dialog).toHaveAccessibleDescription('All gone.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('confirm-accept'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
