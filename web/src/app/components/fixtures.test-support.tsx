import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

import { DEFAULT_PREFERENCES } from '../data/store';
import { I18nProvider } from '../i18n/I18nProvider';
import { DEFAULT_TRAIL_SETTINGS } from '../lib/trails/types';
import type { AppState } from '../useAppState';
import { CacheMarksProvider } from './CacheDetails/marks';
import { ToastProvider } from './Toast/ToastProvider';

export {
  makeCache,
  makeCaches,
  makeTrail,
} from '../lib/ui-logic/ui.test-support';

/** Renders inside the real I18nProvider, in English unless the test stores another language first. */
export function renderWithI18n(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: I18nProvider, ...options });
}

/** Mark actions as spies, with the given codes already marked. */
export function makeMarks({
  found = [],
  ignored = [],
}: { found?: string[]; ignored?: string[] } = {}) {
  return {
    locallyFound: new Set(found),
    ignored: new Set(ignored),
    markFound: vi.fn(),
    unmarkFound: vi.fn(),
    ignore: vi.fn(),
    unignore: vi.fn(),
  };
}

/** Renders inside every provider a screen expects: language, toasts, and the cache marks. */
export function renderWithProviders(
  ui: ReactElement,
  { marks = makeMarks() }: { marks?: ReturnType<typeof makeMarks> } = {},
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider>
      <ToastProvider>
        <CacheMarksProvider marks={marks}>{children}</CacheMarksProvider>
      </ToastProvider>
    </I18nProvider>
  );
  return { marks, ...render(ui, { wrapper: Wrapper }) };
}

/** The app's state with the given data and every action a spy, for a screen tested without storage. */
export function makeApp(overrides: Partial<AppState> = {}): AppState {
  return {
    ready: true,
    caches: [],
    settings: DEFAULT_TRAIL_SETTINGS,
    walk: undefined,
    preferences: DEFAULT_PREFERENCES,
    importInfo: undefined,
    importing: false,
    lastImport: undefined,
    error: undefined,
    pendingShare: [],
    acceptShare: vi.fn(() => Promise.resolve()),
    declineShare: vi.fn(),
    importFiles: vi.fn(() => Promise.resolve()),
    importSample: vi.fn(() => Promise.resolve()),
    applySettings: vi.fn(),
    setPreferences: vi.fn(),
    clearData: vi.fn(() => Promise.resolve()),
    ...makeMarks(),
    resetLocallyFound: vi.fn(),
    startWalk: vi.fn(),
    recordOutcome: vi.fn(),
    undoOutcome: vi.fn(),
    reverseWalk: vi.fn(),
    endWalk: vi.fn(),
    dismissImport: vi.fn(),
    dismissError: vi.fn(),
    ...overrides,
  };
}
