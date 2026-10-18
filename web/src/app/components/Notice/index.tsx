'use client';

import { useI18n } from '../../i18n/useI18n';
import type { AppError } from '../../useAppState';
import { Icon } from '../Icon';

type Translate = ReturnType<typeof useI18n>['t'];

function message(t: Translate, error: AppError): string {
  switch (error) {
    case 'load-failed':
      return t('error.loadFailed');
    case 'import-failed':
      return t('error.importFailed');
    case 'save-failed':
      return t('error.saveFailed');
    case 'sample-failed':
      return t('error.sampleFailed');
    case 'share-empty':
      return t('error.shareEmpty');
  }
}

interface ErrorNoticeProps {
  error: AppError;
  onDismiss: () => void;
}

/** A failure the user should know about, announced as it appears. */
export function ErrorNotice({ error, onDismiss }: ErrorNoticeProps) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      data-testid="error-notice"
      className="flex items-start justify-between gap-2 border-b border-destructive/30 bg-destructive-soft px-4 py-2 text-sm text-destructive"
    >
      <p>{message(t, error)}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.dismiss')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-card"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
