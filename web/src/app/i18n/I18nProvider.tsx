'use client';
import {
  createContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { readStoredValue, writeStoredValue } from '../data/browserStorage';
import de from './de.json';
import en from './en.json';
import {
  formatNumbers,
  formattingLocale,
  interpolate,
  pickLanguage,
  resolveTranslationKey,
  type Language,
  type TranslationValues,
} from './translate';

const translations = { de, en };

type FlattenKeys<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: FlattenKeys<
        T[K],
        `${Prefix}${Prefix extends '' ? '' : '.'}${K}`
      >;
    }[keyof T & string];

export type TranslationKey = FlattenKeys<typeof en>;

/** Fills each `{name}` placeholder the template holds from `values`, numbers in the formatting locale. */
type Translate = (key: TranslationKey, values?: TranslationValues) => string;

type I18nContextType = {
  language: Language;
  /** What dates and numbers are formatted in: the app language, in the browser's own regional form of it when it has one. */
  locale: string;
  setLanguage: (language: Language) => void;
  t: Translate;
  /** Picks `${baseKey}_one` when the locale's plural rule says 'one', else `baseKey`. */
  tCount: (
    baseKey: TranslationKey,
    values: TranslationValues & { count: number },
  ) => string;
};

export const I18nContext = createContext<I18nContextType | undefined>(
  undefined,
);

const LANGUAGE_STORAGE_KEY = 'lang';

function detectLanguage(): Language {
  return pickLanguage(
    readStoredValue(LANGUAGE_STORAGE_KEY),
    navigator.language,
  );
}

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  // Starts at 'de' to match the prerendered markup; the layout effect corrects it before paint.
  const [language, setLanguage] = useState<Language>('de');
  // t reads language through this ref so its identity survives a language change.
  const languageRef = useRef(language);
  // eslint-disable-next-line react-hooks/refs -- written during render so t never reads a stale language in this render
  languageRef.current = language;

  // Prerendered markup holds no date and no number past 999, so the build machine's navigator cannot cause a hydration mismatch.
  const locale = useMemo(
    () => formattingLocale(language, navigator.languages),
    [language],
  );
  // Built once per language: t runs on every render, and building a format costs more than using one.
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const numberFormatRef = useRef(numberFormat);
  // eslint-disable-next-line react-hooks/refs -- written during render, as languageRef, so t formats numbers for this render's language
  numberFormatRef.current = numberFormat;

  useLayoutEffect(() => {
    setLanguage(detectLanguage());
  }, []);

  const setLanguageAndPersist = useCallback((next: Language) => {
    setLanguage(next);
    writeStoredValue(LANGUAGE_STORAGE_KEY, next);
  }, []);

  // Keeps <html lang> and the meta description with the language, or screen readers use the wrong phonetics.
  useEffect(() => {
    document.documentElement.lang = language;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translations[language].page.tagline);
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, values: TranslationValues = {}) =>
      interpolate(
        resolveTranslationKey(translations[languageRef.current], key) ?? key,
        formatNumbers(values, numberFormatRef.current),
      ),
    [],
  );

  const tCount = useCallback<I18nContextType['tCount']>((baseKey, values) => {
    const dictionary = translations[languageRef.current];
    const category = new Intl.PluralRules(languageRef.current).select(
      values.count,
    );
    const template =
      (category === 'one'
        ? resolveTranslationKey(dictionary, `${baseKey}_one`)
        : undefined) ??
      resolveTranslationKey(dictionary, baseKey) ??
      baseKey;
    return interpolate(
      template,
      formatNumbers(values, numberFormatRef.current),
    );
  }, []);

  const value = useMemo(
    () => ({ language, locale, setLanguage: setLanguageAndPersist, t, tCount }),
    [language, locale, setLanguageAndPersist, t, tCount],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
