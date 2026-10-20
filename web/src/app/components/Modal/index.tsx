'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { Icon } from '../Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  /** Read out with the title when the dialog opens. */
  description?: string;
  onClose: () => void;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
  /** On a phone: a sheet from the bottom, or the whole screen. */
  phoneLayout?: 'sheet' | 'fullScreen';
  testId?: string;
}

const PHONE_LAYOUT_CLASSES = {
  sheet: { backdrop: 'items-end', panel: 'max-h-[92dvh] rounded-t-3xl' },
  fullScreen: {
    backdrop: 'items-stretch',
    panel: 'h-full sm:h-auto sm:max-h-[92dvh]',
  },
} as const;

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Keeps Tab inside the panel: past the last control back to the first, and the reverse; from outside, back in. */
function trapTab(panel: HTMLElement, event: KeyboardEvent) {
  const focusables = focusablesIn(panel);
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const current = document.activeElement;
  // On the panel itself or outside it, as after its focused control went away.
  const away = current === panel || !panel.contains(current);
  if (event.shiftKey && (away || current === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (away || current === last)) {
    event.preventDefault();
    first.focus();
  }
}

/** The dialog drawn over every other: the last open one in the document, as a nested dialog comes after its parent. */
function isTopMost(panel: HTMLElement): boolean {
  const open = document.querySelectorAll('[aria-modal="true"]');
  return open[open.length - 1] === panel;
}

/** A modal dialog: focus moves in and is trapped, Escape closes, focus returns to where it was. */
export function Modal({
  title,
  description,
  onClose,
  children,
  role = 'dialog',
  phoneLayout = 'sheet',
  testId,
}: ModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // An SVG element focuses alike, so either kind gets its focus back.
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current!;
    // The first field or action, not the close button: that is what the dialog was opened for.
    const [close, ...rest] = focusablesIn(panel);
    (rest[0] ?? close).focus();
    // On the document, so a key counts wherever focus fell: on the body after the focused control went away.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopMost(panel)) return;
      if (event.key === 'Escape') {
        // So the dialog below, once this one is gone, does not close on the same key press.
        event.stopImmediatePropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        event.stopImmediatePropagation();
        trapTab(panel, event);
      }
    };
    let refocus: number | undefined;
    const pullFocusBack = () => {
      const current = document.activeElement;
      // Not when the window itself lost focus: the user is coming back to the field they left.
      if (!isTopMost(panel) || panel.contains(current) || !document.hasFocus())
        return;
      panel.focus({ preventScroll: true });
    };
    // Checked once the move is over: a focus() during focusout is undone by the move it interrupts.
    const onFocusOut = () => {
      window.clearTimeout(refocus);
      refocus = window.setTimeout(pullFocusBack);
    };
    document.addEventListener('keydown', onKeyDown);
    panel.addEventListener('focusout', onFocusOut);
    return () => {
      window.clearTimeout(refocus);
      document.removeEventListener('keydown', onKeyDown);
      panel.removeEventListener('focusout', onFocusOut);
      opener?.focus();
    };
  }, []);

  const layout = PHONE_LAYOUT_CLASSES[phoneLayout];
  return (
    <div
      className={`fixed inset-0 z-[2000] flex ${layout.backdrop} justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4`}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid={testId}
        className={`flex ${layout.panel} w-full max-w-lg flex-col overflow-hidden bg-card outline-none text-card-foreground shadow-2xl sm:rounded-3xl`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid="dialog-close"
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {description && (
            <p id={descriptionId} className="mb-4">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
