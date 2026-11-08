'use client';

import { useId, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import {
  buildFieldNotes,
  type FieldNoteEntry,
} from '../../lib/export/fieldNotes';
import { Icon } from '../Icon';
import { useToast } from '../Toast/ToastProvider';
import { buttonClasses, FIELD_CLASSES } from '../ui/classes';
import { downloadFile } from '../ui/download';

/** Geocaching.com's limit for a log. */
const MAX_LOG_LENGTH = 4000;

/** The log text for every visit, and the button that saves them as `geocache_visits.txt`. */
export function FieldNotesExport({
  entries,
}: {
  entries: readonly FieldNoteEntry[];
}) {
  const { t } = useI18n();
  const toast = useToast();
  const messageId = useId();
  const [message, setMessage] = useState('');

  const exportNotes = () => {
    downloadFile({
      name: 'geocache_visits.txt',
      // A copy on a plain ArrayBuffer, which is what Blob accepts.
      data: Uint8Array.from(buildFieldNotes(entries, message)),
      type: 'text/plain;charset=utf-16le',
    });
    toast.show(t('toast.notesSaved'));
  };

  return (
    <>
      <label htmlFor={messageId} className="block text-sm font-semibold">
        {t('summary.messageLabel')}
      </label>
      <textarea
        id={messageId}
        data-testid="field-notes-message"
        value={message}
        onChange={(event) => setMessage(event.currentTarget.value)}
        placeholder={t('summary.messagePlaceholder')}
        maxLength={MAX_LOG_LENGTH}
        rows={2}
        className={FIELD_CLASSES}
      />
      <button
        type="button"
        onClick={exportNotes}
        data-testid="export-field-notes"
        className={buttonClasses('primary', 'w-full')}
      >
        <Icon name="download" />
        {t('summary.exportNotes')}
      </button>
    </>
  );
}
