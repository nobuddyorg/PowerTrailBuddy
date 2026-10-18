import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

const source = readFileSync(
  new URL('../../public/sw.js', import.meta.url),
  'utf8',
);

export const ORIGIN = 'https://example.test';
export const SCRIPT_URL = `${ORIGIN}/PowerTrailBuddy/sw.js?build=b1`;

interface Worker {
  origin: string;
  basePath: string;
}
type Strategy = 'pass-through' | 'share' | 'cache-first' | 'network-first';
interface RequestShape {
  url: string;
  method: string;
  mode: string;
}
export interface FakeEvent {
  request?: Request;
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}

interface WorkerScript {
  CACHE_NAME: string;
  WORKER: Worker;
  MAX_SHARED_FILES: number;
  MAX_SHARED_BYTES: number;
  SHARED_FILES_CACHE: string;
  SHARE_FILES_FIELD: string;
  cacheNameFor: (search: string) => string;
  basePathFor: (workerPathname: string) => string;
  isStaleCache: (key: string, current: string) => boolean;
  strategyFor: (request: RequestShape, worker: Worker) => Strategy;
  sharedFilePath: (basePath: string, index: number, name: string) => string;
  sharedFilesWithinLimits: (values: (File | string)[]) => File[];
  receiveShare: (request: Request) => Promise<Response>;
  cacheFirst: (request: Request) => Promise<Response>;
  networkFirst: (request: Request) => Promise<Response>;
}

const EXPORTED = [
  'CACHE_NAME',
  'WORKER',
  'MAX_SHARED_FILES',
  'MAX_SHARED_BYTES',
  'SHARED_FILES_CACHE',
  'SHARE_FILES_FIELD',
  'cacheNameFor',
  'basePathFor',
  'isStaleCache',
  'strategyFor',
  'sharedFilePath',
  'sharedFilesWithinLimits',
  'receiveShare',
  'cacheFirst',
  'networkFirst',
];

// sw.js is a plain script with no import path, so the whole source runs against a fake `self` and its names are returned.
export function loadWorker(scriptUrl = SCRIPT_URL) {
  const listeners = new Map<string, (event: FakeEvent) => void>();
  const self = {
    location: new URL(scriptUrl),
    addEventListener: (type: string, listener: (event: FakeEvent) => void) =>
      listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(() => Promise.resolve()) },
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- sw.js exports nothing; evaluating its source is the only way in
  const factory = new Function(
    'self',
    `${source}\nreturn { ${EXPORTED.join(', ')} };`,
  ) as (scope: typeof self) => WorkerScript;
  return { worker: factory(self), self, listeners };
}
