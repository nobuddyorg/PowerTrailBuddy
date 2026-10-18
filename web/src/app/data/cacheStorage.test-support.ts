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

  function cacheNamed(name: string): Map<string, Response> {
    const existing = caches.get(name);
    if (existing) return existing;
    const created = new Map<string, Response>();
    caches.set(name, created);
    return created;
  }

  function asCache(entries: Map<string, Response>): Cache {
    const cache: Pick<Cache, 'put' | 'match' | 'keys'> = {
      put: async (input, response) => {
        if (refusePut) throw new DOMException('full', 'QuotaExceededError');
        entries.set(resolve(input), response);
      },
      match: async (input) => entries.get(resolve(input))?.clone(),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
    };
    return cache as Cache;
  }

  return {
    storage: {
      open: async (name) => asCache(cacheNamed(name)),
      delete: async (name) => caches.delete(name),
      keys: async () => [...caches.keys()],
      match: async (input) => {
        for (const entries of caches.values()) {
          const hit = entries.get(resolve(input));
          if (hit) return hit.clone();
        }
        return undefined;
      },
    },
    urls: (cacheName) => [...(caches.get(cacheName)?.keys() ?? [])],
  };
}
