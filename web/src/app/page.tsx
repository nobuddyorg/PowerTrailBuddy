'use client';

import { useI18n } from './i18n/useI18n';

export default function Page() {
  const { t } = useI18n();

  return (
    <main
      id="main-content"
      data-testid="home"
      className="mx-auto min-h-[100dvh] max-w-3xl px-4 py-8 space-y-4"
    >
      <h1 data-testid="home-title" className="text-2xl font-bold">
        {t('brand.name')}
      </h1>
      <p>{t('page.tagline')}</p>
      <p className="text-muted-foreground">{t('page.intro')}</p>
    </main>
  );
}
