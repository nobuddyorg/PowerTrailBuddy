// The service worker answers a share with a redirect to `<base>/?shared=1`; the contract is in architecture.md.
const SHARED_PARAM = 'shared';

/** True when the page was opened by the share target's redirect. */
export function isSharedLaunch(search: string): boolean {
  return new URLSearchParams(search).get(SHARED_PARAM) === '1';
}

/** The same URL without the share marker, so a reload does not look for shared files again. */
export function withoutSharedParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(SHARED_PARAM);
  return url.href;
}
