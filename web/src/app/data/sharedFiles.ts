// Written by public/sw.js when the share target receives a POST; the cache name and URL shape are its contract.
export const SHARED_FILES_CACHE = 'powertrailbuddy-shared-files';

const SHARED_FILE_PATH = /\/shared-file\/(\d+)\/([^/]+)$/;

interface SharedEntry {
  request: Request;
  index: number;
  name: string;
}

function toSharedEntry(request: Request): SharedEntry[] {
  const match = SHARED_FILE_PATH.exec(new URL(request.url).pathname);
  if (!match) return [];
  return [
    { request, index: Number(match[1]), name: decodeURIComponent(match[2]) },
  ];
}

/** The files shared to the app since the last call, in the order shared; the cache is emptied either way. */
export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  const cache = await caches.open(SHARED_FILES_CACHE);
  const entries = (await cache.keys())
    .flatMap(toSharedEntry)
    .sort((a, b) => a.index - b.index);

  const files: File[] = [];
  for (const { request, name } of entries) {
    const response = await cache.match(request);
    if (!response) continue;
    const type = response.headers.get('content-type') ?? '';
    files.push(new File([await response.blob()], name, { type }));
  }
  await caches.delete(SHARED_FILES_CACHE);
  return files;
}
