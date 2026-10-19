'use client';

import { useId, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { Icon } from '../Icon';

/** The hint, hidden until asked for: many walkers want to search first. */
export function HintSpoiler({ hint }: { hint: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const panelId = useId();
  if (hint === '')
    return <p className="text-sm text-muted-foreground">{t('cache.noHint')}</p>;
  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        data-testid="hint-toggle"
        aria-controls={panelId}
        onClick={() => setShown((current) => !current)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
      >
        <Icon name="bulb" />
        {shown ? t('cache.hideHint') : t('cache.showHint')}
      </button>
      <p
        id={panelId}
        hidden={!shown}
        data-testid="hint"
        className="mt-1 whitespace-pre-line rounded-xl bg-accent-soft px-3 py-2 text-sm"
      >
        {hint}
      </p>
    </div>
  );
}
