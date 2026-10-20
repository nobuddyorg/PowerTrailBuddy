// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });
});

describe('Modal once focus has left it', () => {
  function Stacked({ onClose }: { onClose: (title: string) => void }) {
    const [open, setOpen] = useState(['Outer', 'Inner', 'Sibling']);
    const close = (title: string) => () => {
      onClose(title);
      setOpen((current) => current.filter((each) => each !== title));
    };
    return (
      <>
        <button type="button">page</button>
        {open.includes('Outer') && (
          <Modal title="Outer" onClose={close('Outer')}>
            <input aria-label="Outer field" />
            {open.includes('Inner') && (
              <Modal title="Inner" onClose={close('Inner')}>
                <input aria-label="Inner field" />
              </Modal>
            )}
          </Modal>
        )}
        {open.includes('Sibling') && (
          <Modal title="Sibling" onClose={close('Sibling')}>
            <input aria-label="Sibling field" />
          </Modal>
        )}
      </>
    );
  }

  const dropFocus = () => (document.activeElement as HTMLElement).blur();

  it('still traps Tab and closes on Escape with focus on the page', () => {
    const onClose = vi.fn();
    renderWithI18n(<Opener onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    dropFocus();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    dropFocus();
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    dropFocus();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tabs from the panel itself into its controls, either way', () => {
    renderWithI18n(<Opener />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    const dialog = screen.getByRole('dialog');
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('closes only the dialog on top, one Escape at a time', () => {
    const onClose = vi.fn();
    renderWithI18n(<Stacked onClose={onClose} />);
    for (const title of ['Sibling', 'Inner', 'Outer']) {
      dropFocus();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(onClose).toHaveBeenLastCalledWith(title);
    }
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pulls focus back into the dialog on top when it moves out', async () => {
    renderWithI18n(<Stacked onClose={() => {}} />);
    const sibling = screen.getByRole('dialog', { name: 'Sibling' });
    screen.getByLabelText('Sibling field').focus();
    screen.getByRole('button', { name: 'page', hidden: true }).focus();
    await waitFor(() => expect(sibling).toHaveFocus());
    screen.getByLabelText('Inner field').focus();
    await waitFor(() => expect(sibling).toHaveFocus());
    screen.getByLabelText('Sibling field').focus();
    dropFocus();
    await waitFor(() => expect(sibling).toHaveFocus());
  });

  it('leaves focus be when the whole window lost it', async () => {
    const page = () =>
      screen.getByRole('button', { name: 'page', hidden: true });
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    renderWithI18n(
      <>
        <button type="button">page</button>
        <Modal title="Alone" onClose={() => {}}>
          <input aria-label="Field" />
        </Modal>
      </>,
    );
    page().focus();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(page()).toHaveFocus();
    hasFocus.mockRestore();
  });
});

describe('Modal without controls of its own', () => {
  it('focuses its close button', () => {
    renderWithI18n(
      <Modal title="Info" onClose={() => {}}>
        <p>Nothing to choose.</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('asks with its message, Cancel focused first, and confirms on request', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithI18n(
      <ConfirmDialog
        title="Clear?"
        message="All gone."
        confirmLabel="Clear"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
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
