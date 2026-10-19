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
  testId?: string;
}

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Keeps Tab inside the panel: past the last control back to the first, and the reverse. */
function trapTab(panel: HTMLElement, event: KeyboardEvent) {
  const focusables = focusablesIn(panel);
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** A modal dialog: focus moves in and is trapped, Escape closes, focus returns to where it was. */
export function Modal({
  title,
  description,
  onClose,
  children,
  role = 'dialog',
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
    // Stopped here, so a dialog opened over another one closes alone.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        event.stopPropagation();
        trapTab(panel, event);
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid={testId}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card text-card-foreground shadow-2xl sm:rounded-3xl"
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
