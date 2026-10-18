'use client';

import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { ImportFileError } from '../../lib/geocache/importFiles';
import type { ImportSummary as Summary } from '../../useAppState';
import { Icon } from '../Icon';

type Translate = ReturnType<typeof useI18n>['t'];

function reason(t: Translate, error: ImportFileError): string {
  switch (error) {
    case 'unsupported':
      return t('import.error.unsupported');
    case 'unreadable':
      return t('import.error.unreadable');
    case 'too-large':
      return t('import.error.tooLarge');
  }
}

interface ImportSummaryProps {
  summary: Summary;
  onDismiss: () => void;
}

/** How long a summary without a refused file stays before it goes by itself. */
export const SUMMARY_MS = 6000;

/** What the last import read, and why a file was refused; a clean import's summary goes by itself. */
export function ImportSummary({ summary, onDismiss }: ImportSummaryProps) {
  const { t, tCount } = useI18n();
  const failed = summary.files.filter((file) => file.error !== undefined);
  const clean = failed.length === 0;
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (!clean) return;
    const timer = window.setTimeout(() => onDismissRef.current(), SUMMARY_MS);
    return () => window.clearTimeout(timer);
  }, [clean, summary]);

  return (
    <div
      role="status"
      data-testid="import-summary"
      className="flex items-start justify-between gap-2 border-b border-primary/20 bg-primary-soft px-4 py-1 text-sm text-primary-strong"
    >
      <div className="py-2">
        <p className="font-medium">
          {t('import.summary', {
            caches: tCount('import.cacheCount', { count: summary.cacheCount }),
            files: tCount('import.fileCount', { count: summary.files.length }),
          })}
        </p>
        {!clean && (
          <ul className="mt-1 space-y-0.5">
            {failed.map((file, index) => (
              <li
                // A name can repeat when the same file is picked twice; the position cannot.
                key={`${index}-${file.name}`}
                data-testid="import-file"
                className="text-destructive"
              >
                {t('import.fileFailed', {
                  name: file.name,
                  reason: reason(t, file.error!),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.dismiss')}
        data-testid="import-summary-dismiss"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-card"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
