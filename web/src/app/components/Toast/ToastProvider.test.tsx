// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n/I18nProvider';
import { useCacheMarks } from '../CacheDetails/marks';
import {
  TOAST_MS,
  TOAST_WITH_ACTION_MS,
  ToastProvider,
  useToast,
} from './ToastProvider';

function Trigger({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.show('Plain')}>
        plain
      </button>
      <button
        type="button"
        onClick={() =>
          toast.show('With action', { label: 'Undo it', onAction: onUndo })
        }
      >
        action
      </button>
    </>
  );
}

function renderTrigger() {
  const onUndo = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onUndo };
}

const wait = (milliseconds: number) =>
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('announces a message in a live region and lets it go after a few seconds', () => {
    renderTrigger();
    fireEvent.click(screen.getByText('plain'));
    expect(screen.getByRole('status')).toHaveTextContent('Plain');
    wait(TOAST_MS - 1);
    expect(screen.getByTestId('toast')).toBeInTheDocument();
    wait(1);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('keeps a message with an action longer, and runs the action once', () => {
    const { onUndo } = renderTrigger();
    fireEvent.click(screen.getByText('action'));
    wait(TOAST_WITH_ACTION_MS - 1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo it' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('lets an action toast go by itself too', () => {
    renderTrigger();
    fireEvent.click(screen.getByText('action'));
    wait(TOAST_WITH_ACTION_MS);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('replaces the shown message with a new one, with a fresh timer', () => {
    renderTrigger();
    fireEvent.click(screen.getByText('plain'));
    wait(TOAST_MS - 100);
    fireEvent.click(screen.getByText('action'));
    wait(200);
    expect(screen.getByTestId('toast')).toHaveTextContent('With action');
  });

  it('is dismissed by its close button', () => {
    renderTrigger();
    fireEvent.click(screen.getByText('plain'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('refuses to be used outside its provider, as do the cache marks', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used within a ToastProvider',
    );
    expect(() => renderHook(() => useCacheMarks())).toThrow(
      'useCacheMarks must be used within a CacheMarksProvider',
    );
  });
});
