// An in-memory CacheStorage with the subset of the API public/sw.js and data/sharedFiles.ts use.
export interface FakeCacheStorage {
  storage: Pick<CacheStorage, 'open' | 'delete' | 'keys' | 'match'>;
  /** URLs stored in one cache, in insertion order; empty for a cache that does not exist. */
  urls(cacheName: string): string[];
}

interface Options {
  /** What a relative URL resolves against: the worker script, as in a browser. */
  baseUrl: string;
  /** Every put() rejects, as when the storage quota is exhausted. */
  refusePut?: boolean;
}

export function fakeCacheStorage({
  baseUrl,
  refusePut = false,
}: Options): FakeCacheStorage {
  const caches = new Map<string, Map<string, Response>>();

  const resolve = (input: RequestInfo | URL) =>
    input instanceof Request ? input.url : new URL(input, baseUrl).href;

  const withoutSearch = (url: string) => url.replace(/\?.*$/, '');

  function matchIn(
    entries: Map<string, Response>,
    input: RequestInfo | URL,
    options?: CacheQueryOptions,
  ): Response | undefined {
    const url = resolve(input);
    if (!options?.ignoreSearch) return entries.get(url)?.clone();
    const key = [...entries.keys()].find(
      (stored) => withoutSearch(stored) === withoutSearch(url),
    );
    return key === undefined ? undefined : entries.get(key)?.clone();
  }

  function cacheNamed(name: string): Map<string, Response> {
    const existing = caches.get(name);
    if (existing) return existing;
    const created = new Map<string, Response>();
    caches.set(name, created);
    return created;
  }

  function asCache(entries: Map<string, Response>): Cache {
    // As in a browser, putting a URL again removes its old entry and appends the new one.
    const put = async (input: RequestInfo | URL, response: Response) => {
      if (refusePut) throw new DOMException('full', 'QuotaExceededError');
      entries.delete(resolve(input));
      entries.set(resolve(input), response);
    };
    const cache: Pick<Cache, 'put' | 'addAll' | 'match' | 'keys' | 'delete'> = {
      put,
      delete: async (input) => entries.delete(resolve(input)),
      // As in a browser: every response fetched first, then all stored, or none on a failure.
      addAll: async (inputs: RequestInfo[]) => {
        const responses = await Promise.all(
          inputs.map(async (input) => {
            const response = await fetch(input);
            if (!response.ok) throw new TypeError(`HTTP ${response.status}`);
            return response;
          }),
        );
        for (const [index, response] of responses.entries()) {
          await put(inputs[index], response);
        }
      },
      match: async (input, options) => matchIn(entries, input, options),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
    };
    return cache as Cache;
  }

  return {
    storage: {
      open: async (name) => asCache(cacheNamed(name)),
      delete: async (name) => caches.delete(name),
      keys: async () => [...caches.keys()],
      match: async (input, options) => {
        for (const entries of caches.values()) {
          const hit = matchIn(entries, input, options);
          if (hit) return hit;
        }
        return undefined;
      },
    },
    urls: (cacheName) => [...(caches.get(cacheName)?.keys() ?? [])],
  };
}
