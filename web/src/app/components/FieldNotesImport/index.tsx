'use client';

import { useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { FieldNoteEntry } from '../../lib/export/fieldNotes';
import { readFieldNotes } from '../../lib/export/readFieldNotes';
import { DRAFTS_UPLOAD_URL } from '../../lib/navigation/links';
import { FieldNotesExport } from '../FieldNotesExport';
import { ImportButton } from '../ImportButton';

/** Field notes saved earlier, loaded again to add a log text and save them anew, and the way to upload them. */
export function FieldNotesImport() {
  const { t, tCount } = useI18n();
  const [entries, setEntries] = useState<FieldNoteEntry[]>([]);
  const [error, setError] = useState('');

  const load = async (file: File) => {
    const reading = readFieldNotes(new Uint8Array(await file.arrayBuffer()));
    if ('entries' in reading) {
      setEntries(reading.entries);
      setError('');
      return;
    }
    setEntries([]);
    setError(
      reading.problem === 'bad-line'
        ? t('data.notesError.line', { line: reading.line })
        : t('data.notesError.file'),
    );
  };

  return (
    <section className="space-y-2 text-sm">
      <p className="text-muted-foreground">{t('data.notesHelp')}</p>
      <ImportButton
        label={t('data.notesButton')}
        onFiles={(files) => {
          // One file at most: a cancelled picker hands over none.
          for (const file of files.slice(0, 1)) void load(file);
        }}
        disabled={false}
        variant="secondary"
        className="w-full"
        accept=".txt,text/plain"
        multiple={false}
        testId="field-notes-input"
      />
      {error !== '' && (
        <p
          role="alert"
          data-testid="field-notes-error"
          className="text-destructive"
        >
          {error}
        </p>
      )}
      {entries.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-border/60">
          <p data-testid="field-notes-read">
            {tCount('data.notesRead', { count: entries.length })}
          </p>
          <FieldNotesExport entries={entries} />
        </div>
      )}
      <a
        href={DRAFTS_UPLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="upload-drafts-link"
        className="inline-block font-semibold text-primary underline"
      >
        {t('data.notesLink')}
      </a>
    </section>
  );
}
