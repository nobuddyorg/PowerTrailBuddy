import './globals.css';
import { withBasePath } from './env';
import de from './i18n/de.json';
import { I18nProvider } from './i18n/I18nProvider';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

// Hand-written head tags, not Next's `metadata` export, which duplicates each tag on hydration in this version.
const THEME_COLORS = [
  { media: '(prefers-color-scheme: light)', color: '#f3f5ef' },
  { media: '(prefers-color-scheme: dark)', color: '#151a14' },
];

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
    <html lang="de">
      <head>
        <title>PowerTrailBuddy</title>
        {/* I18nProvider updates this via a `meta[name="description"]` selector that must keep matching. */}
        <meta name="description" content={de.page.tagline} />
        <link rel="manifest" href={withBasePath('/site.webmanifest')} />
        {THEME_COLORS.map(({ media, color }) => (
          <meta key={media} name="theme-color" content={color} media={media} />
        ))}
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
