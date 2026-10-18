// Pure helpers behind I18nProvider: no React, no browser APIs, so mutation testing reaches all of them.

export type Language = 'de' | 'en';

type TranslationValue = string | { [key: string]: TranslationValue };

// undefined on any miss (unknown segment, or a sub-object), so callers decide what a miss means.
export function resolveTranslationKey(
  dictionary: TranslationValue,
  key: string,
): string | undefined {
  const value = key.split('.').reduce<TranslationValue | undefined>(
    (current, segment) =>
      typeof current === 'object' &&
      // eslint-disable-next-line sonarjs/different-types-comparison -- a translation JSON can carry a literal null the type has not seen
      current !== null &&
      Object.hasOwn(current, segment)
        ? current[segment]
        : undefined,
    dictionary,
  );
  return typeof value === 'string' ? value : undefined;
}

export type TranslationValues = Record<string, string | number>;

// A replacer function, never a replacement string: user text such as "US$$" or "$'" must land verbatim.
export function interpolate(
  template: string,
  values: TranslationValues,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

/** Each number in the format's digit grouping (1.000 in German, 1,000 in English); text as given. */
export function formatNumbers(
  values: TranslationValues,
  numberFormat: Intl.NumberFormat,
): TranslationValues {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      typeof value === 'number' ? numberFormat.format(value) : value,
    ]),
  );
}

function isLanguage(value: string | null): value is Language {
  return value === 'de' || value === 'en';
}

/** A stored choice, else the browser's language, else German; `LANG_INIT_SCRIPT` in layout.tsx decides the same way. */
export function pickLanguage(
  stored: string | null,
  browserLocale: string,
): Language {
  if (isLanguage(stored)) return stored;
  const browserLanguage = browserLocale.split('-')[0];
  return isLanguage(browserLanguage) ? browserLanguage : 'de';
}

/** The first browser locale in `language` (en-GB keeps 31/12/2099), else the bare language. */
export function formattingLocale(
  language: Language,
  browserLocales: readonly string[],
): string {
  return (
    browserLocales.find((locale) => locale.split('-')[0] === language) ??
    language
  );
}
