'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useI18n } from '../../i18n/useI18n';
import { Icon } from '../Icon';

interface ToastAction {
  label: string;
  onAction: () => void;
}

interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  /** Shows a short message, replacing any shown; with an action (e.g. Undo) it stays longer. */
  show: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

export const TOAST_MS = 4000;
export const TOAST_WITH_ACTION_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toast, setToast] = useState<Toast>();

  const show = useCallback((message: string, action?: ToastAction) => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message, action }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => setToast(undefined),
      toast.action ? TOAST_WITH_ACTION_MS : TOAST_MS,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Always mounted, so screen readers announce what appears in it. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[3000] flex justify-center px-4 lg:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            data-testid="toast"
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl bg-foreground py-1.5 pl-4 pr-1.5 text-sm text-background shadow-soft motion-safe:animate-[ptb-toast-in_180ms_ease-out]"
          >
            <span className="py-2">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                data-testid="toast-action"
                onClick={() => {
                  toast.action?.onAction();
                  setToast(undefined);
                }}
                className="min-h-11 rounded-xl px-3 font-semibold text-accent-bright hover:bg-white/10"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(undefined)}
              aria-label={t('common.dismiss')}
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
