'use client';

import { withBasePath } from '../../env';
import { useI18n } from '../../i18n/useI18n';
import type { Language } from '../../i18n/translate';
import { useOnline } from '../../useBrowserState';
import { useInstallPrompt } from '../../useInstallPrompt';
import { Icon } from '../Icon';
import { ICON_BUTTON_CLASSES } from '../ui/classes';

const LANGUAGES: readonly Language[] = ['de', 'en'];

interface HeaderProps {
  /** Data and settings stay out of the way while a walk is guided. */
  walking: boolean;
  onOpenData: () => void;
  onOpenSettings: () => void;
}

function LanguageToggle() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div
      role="group"
      aria-label={t('header.language')}
      data-testid="language-switch"
      className="flex rounded-xl bg-muted p-0.5"
    >
      {LANGUAGES.map((each) => (
        <button
          key={each}
          type="button"
          lang={each}
          data-testid={`language-${each}`}
          aria-pressed={language === each}
          onClick={() => setLanguage(each)}
          className="min-h-10 min-w-10 rounded-[10px] px-2 text-xs font-bold text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-soft"
        >
          {each === 'de' ? t('header.german') : t('header.english')}
        </button>
      ))}
    </div>
  );
}

export function Header({ walking, onOpenData, onOpenSettings }: HeaderProps) {
  const { t } = useI18n();
  const online = useOnline();
  const { canInstall, install } = useInstallPrompt();
  return (
    <header className="z-[1100] flex items-center justify-between gap-2 border-b border-border/70 bg-card/95 px-3 py-1.5 shadow-soft backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static export has no image optimiser to serve next/image */}
        <img
          src={withBasePath('/logo.svg')}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0"
        />
        <h1
          data-testid="home-title"
          className="truncate text-lg font-extrabold tracking-tight text-primary-strong"
        >
          {t('brand.name')}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!online && (
          <span
            data-testid="offline"
            role="status"
            className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-xs font-semibold text-warning"
          >
            <Icon name="offline" className="h-4 w-4" />
            <span className="hidden sm:inline">{t('header.offline')}</span>
            <span className="sr-only sm:hidden">{t('header.offline')}</span>
          </span>
        )}
        {canInstall && (
          <button
            type="button"
            onClick={install}
            aria-label={t('header.install')}
            className={ICON_BUTTON_CLASSES}
          >
            <Icon name="install" />
          </button>
        )}
        <LanguageToggle />
        {!walking && (
          <>
            <button
              type="button"
              onClick={onOpenData}
              aria-label={t('header.data')}
              data-testid="open-data"
              className={ICON_BUTTON_CLASSES}
            >
              <Icon name="database" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={t('header.settings')}
              data-testid="open-settings"
              className={ICON_BUTTON_CLASSES}
            >
              <Icon name="settings" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
