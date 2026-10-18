import type { Geocache } from './types';

export type ImportFileError = 'unsupported' | 'unreadable' | 'too-large';

export interface ImportedFile {
  name: string;
  cacheCount: number;
  error?: ImportFileError;
}

export interface ImportResult {
  /** Deduplicated by code; a later file wins. */
  caches: Geocache[];
  /** One entry per file given, in the order given. */
  files: ImportedFile[];
}

/** Reads Pocket Query `.zip` archives and `.gpx` files into caches. */
export function importFiles(files: readonly File[]): Promise<ImportResult> {
  void files;
  return Promise.reject(new Error('not implemented'));
}
