'use client';

import { useI18n } from '../../i18n/useI18n';
import type { Language } from '../../i18n/translate';
import { Icon } from '../Icon';
import { buttonClasses, CHIP_CLASSES } from '../ui/classes';

const LANGUAGES: readonly Language[] = ['de', 'en'];

function LanguageSetting() {
  const { t, language, setLanguage } = useI18n();
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t('settings.language.title')}</h3>
      <div
        role="group"
        aria-label={t('settings.language.title')}
        className="flex flex-wrap gap-2"
      >
        {LANGUAGES.map((each) => (
          <button
            key={each}
            type="button"
            lang={each}
            data-testid={`language-${each}`}
            aria-pressed={language === each}
            onClick={() => setLanguage(each)}
            className={CHIP_CLASSES}
          >
            {each === 'de'
              ? t('settings.language.german')
              : t('settings.language.english')}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Settings of the app itself, which take effect at once: the language and, while the browser offers it, installing. */
export function AppSettings({
  canInstall,
  onInstall,
}: {
  canInstall: boolean;
  onInstall: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <LanguageSetting />
      {canInstall && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">
            {t('settings.install.title')}
          </h3>
          <button
            type="button"
            data-testid="install-app"
            onClick={onInstall}
            className={buttonClasses('secondary')}
          >
            <Icon name="install" />
            {t('settings.install.button')}
          </button>
          <p className="text-xs text-muted-foreground">
            {t('settings.install.help')}
          </p>
        </section>
      )}
    </>
  );
}
