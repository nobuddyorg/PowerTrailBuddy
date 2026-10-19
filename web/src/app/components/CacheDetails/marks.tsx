'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { useToast } from '../Toast/ToastProvider';

interface Marks {
  locallyFound: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  markFound: (code: string) => void;
  unmarkFound: (code: string) => void;
  ignore: (code: string) => void;
  unignore: (code: string) => void;
}

const MarksContext = createContext<Marks | undefined>(undefined);

/** The found and ignored marks for any cache view, each change confirmed by a toast that can undo it. */
export function CacheMarksProvider({
  marks,
  children,
}: {
  marks: Marks;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { locallyFound, ignored, markFound, unmarkFound, ignore, unignore } =
    marks;
  const value = useMemo<Marks>(
    () => ({
      locallyFound,
      ignored,
      markFound: (code) => {
        markFound(code);
        toast.show(t('toast.markedFound', { code }), {
          label: t('common.undo'),
          onAction: () => unmarkFound(code),
        });
      },
      unmarkFound: (code) => {
        unmarkFound(code);
        toast.show(t('toast.unmarkedFound', { code }));
      },
      ignore: (code) => {
        ignore(code);
        toast.show(t('toast.ignored', { code }), {
          label: t('common.undo'),
          onAction: () => unignore(code),
        });
      },
      unignore: (code) => {
        unignore(code);
        toast.show(t('toast.unignored', { code }));
      },
    }),
    [locallyFound, ignored, markFound, unmarkFound, ignore, unignore, toast, t],
  );
  return (
    <MarksContext.Provider value={value}>{children}</MarksContext.Provider>
  );
}

export function useCacheMarks(): Marks {
  const context = useContext(MarksContext);
  if (!context)
    throw new Error('useCacheMarks must be used within a CacheMarksProvider');
  return context;
}
