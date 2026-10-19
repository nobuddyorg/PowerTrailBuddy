import { Archivo } from 'next/font/google';

import './globals.css';
import { withBasePath } from './env';
import de from './i18n/de.json';
import { I18nProvider } from './i18n/I18nProvider';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

// The nobuddyorg wordmark face; next/font self-hosts it at build time, so font-src 'self' still holds.
const displayFont = Archivo({
  subsets: ['latin'],
  variable: '--font-display-family',
});

// Hand-written head tags, not Next's `metadata` export, which duplicates each tag on hydration in this version.
const THEME_COLOR = '#f3f5ef';

// Same pre-paint trick for `<html lang>`, kept in lockstep with pickLanguage() in i18n/translate.ts.
const LANG_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('lang');var l=(s==='de'||s==='en')?s:(navigator.language||'').split('-')[0];document.documentElement.lang=(l==='de'||l==='en')?l:'de';}catch(e){}})();`;

// GitHub Pages sends no headers, so no frame-ancestors; this breaks out of a clickjacking frame instead.
const FRAMEBUST_SCRIPT = `if(window.top!==window.self){window.top.location=window.self.location;}`;

// connect-src 'self' is the privacy rule in code: imported cache data has nowhere to be sent.
const CONTENT_SECURITY_POLICY = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  // data: is Leaflet's default icon; the tiles are the app's only third-party request.
  `img-src 'self' data: blob: https://tile.openstreetmap.org`,
  `connect-src 'self'`,
  `font-src 'self'`,
  `worker-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={displayFont.variable}>
      <head>
        <title>PowerTrailBuddy</title>
        {/* I18nProvider updates this via a `meta[name="description"]` selector that must keep matching. */}
        <meta name="description" content={de.page.tagline} />
        <link rel="manifest" href={withBasePath('/site.webmanifest')} />
        {/* Unlinked, a browser asks for /favicon.ico at the origin root, outside the base path. */}
        <link rel="icon" href={withBasePath('/favicon.ico')} sizes="any" />
        <link
          rel="icon"
          href={withBasePath('/favicon-32x32.png')}
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="apple-touch-icon"
          href={withBasePath('/apple-touch-icon.png')}
        />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="color-scheme" content="light" />
        {/* As early as possible: a CSP meta tag only covers what the document parses after it. */}
        <meta
          httpEquiv="Content-Security-Policy"
          content={CONTENT_SECURITY_POLICY}
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <script dangerouslySetInnerHTML={{ __html: FRAMEBUST_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <div id="app-root" data-testid="app-root">
          <ServiceWorkerRegistration />
          <I18nProvider>{children}</I18nProvider>
        </div>
      </body>
    </html>
  );
}
