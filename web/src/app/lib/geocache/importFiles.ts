import JSZip from 'jszip';

import { sourcesOf } from './mergeCaches';
import { withParking, type ParkingArea } from './parking';
import { GpxParseError, parseGpx } from './parseGpx';
import type { Geocache } from './types';

export type ImportFileError = 'unsupported' | 'unreadable' | 'too-large';

export interface ImportedFile {
  name: string;
  cacheCount: number;
  error?: ImportFileError;
}

export interface ImportResult {
  /** Deduplicated by code, a later file winning, each with every query that had it; parking areas match across every file given. */
  caches: Geocache[];
  /** One entry per file given, in the order given. */
  files: ImportedFile[];
  /** The queries read in full, sorted: every GPX document that parsed, the ones without caches too. */
  sources: string[];
}

/** Larger than any Pocket Query (1,000 caches is a few MB); applies to a file and to the GPX inside an archive. */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 50;
/** Twenty full Pocket Queries in one import; trail finding on every launch stays within its measured budget up to here. */
export const MAX_IMPORT_CACHES = 20_000;

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const SNIFF_BYTES = 1024;

class ImportFailure extends Error {
  readonly code: ImportFileError;

  constructor(code: ImportFileError) {
    super(code);
    this.code = code;
  }
}

/** JSZip documents `internalStream` and keeps the declared size on `_data`, but types neither. */
interface ArchiveEntry {
  name: string;
  dir: boolean;
  _data: { uncompressedSize: number };
  internalStream(type: 'uint8array'): EntryStream;
}

interface EntryStream {
  on(event: 'data', listener: (chunk: Uint8Array) => void): EntryStream;
  on(event: 'error' | 'end', listener: () => void): EntryStream;
  pause(): EntryStream;
  resume(): EntryStream;
}

/** A query's name as its GPX file gives it, the same across a zip's renaming and a browser's ` (1)` for a repeated download. */
export function sourceName(fileName: string): string {
  const baseName = fileName.slice(
    Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1,
  );
  return baseName
    .replace(/\.gpx$/i, '')
    .replace(/\(\d+\)$/, '')
    .trim()
    .toLowerCase();
}

/** The lower-cased extension, '' when the name has none. */
function extensionOf(name: string): string {
  return /\.([^./\\]+)$/.exec(name)?.[1].toLowerCase() ?? '';
}

/** '' stands for no extension at all: shared files from Android can arrive without one. */
const SUPPORTED_EXTENSIONS = ['zip', 'gpx', ''];

function assertSupportedName(name: string): void {
  if (!SUPPORTED_EXTENSIONS.includes(extensionOf(name))) {
    throw new ImportFailure('unsupported');
  }
}

/** Zip or GPX by extension, else by the first bytes. */
function isArchive(name: string, bytes: Uint8Array): boolean {
  const extension = extensionOf(name);
  if (extension !== '') return extension === 'zip';
  if (ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)) return true;
  const head = new TextDecoder().decode(bytes.subarray(0, SNIFF_BYTES));
  if (head.trimStart().startsWith('<')) return false;
  throw new ImportFailure('unsupported');
}

/** What GPX documents contribute: their caches, their parking areas and the queries they are. */
interface GpxContent {
  caches: Geocache[];
  parkingAreas: ParkingArea[];
  sources: string[];
}

function contentOf(text: string, fileName: string): GpxContent {
  const source = sourceName(fileName);
  try {
    const { caches, parkingAreas } = parseGpx(text);
    return {
      caches: caches.map((cache) => ({ ...cache, sources: [source] })),
      parkingAreas,
      sources: [source],
    };
  } catch (error) {
    if (!(error instanceof GpxParseError)) throw error;
    throw new ImportFailure(
      error.code === 'not-xml' ? 'unreadable' : 'unsupported',
    );
  }
}

/** Inflates and decodes one entry, stopping the moment it inflates past its declared size. */
function textOf(entry: ArchiveEntry): Promise<string> {
  const declared = entry._data.uncompressedSize;
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder();
    let inflated = 0;
    let text = '';
    const stream = entry.internalStream('uint8array');
    stream
      .on('data', (chunk) => {
        inflated += chunk.length;
        if (inflated > declared) {
          stream.pause();
          reject(new ImportFailure('too-large'));
        }
        text += decoder.decode(chunk, { stream: true });
      })
      .on('error', () => reject(new ImportFailure('unreadable')))
      .on('end', () => resolve(text + decoder.decode()))
      .resume();
  });
}

/** Finder's Compress adds an AppleDouble `._` twin of every file, under `__MACOSX/`; neither is GPX. */
function isMacMetadata(name: string): boolean {
  const baseName = name.slice(name.lastIndexOf('/') + 1);
  return name.startsWith('__MACOSX/') || baseName.startsWith('._');
}

function isGpxEntry(entry: ArchiveEntry): boolean {
  return (
    !entry.dir &&
    extensionOf(entry.name) === 'gpx' &&
    !isMacMetadata(entry.name)
  );
}

async function archiveOf(bytes: Uint8Array): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw new ImportFailure('unreadable');
  }
}

/** Every GPX entry of an archive, refusing one whose directory promises too much before inflating anything. */
async function contentOfArchive(bytes: Uint8Array): Promise<GpxContent> {
  const archive = await archiveOf(bytes);
  const entries = Object.values(archive.files) as unknown as ArchiveEntry[];
  if (entries.length > MAX_ARCHIVE_ENTRIES)
    throw new ImportFailure('too-large');
  const gpxEntries = entries.filter(isGpxEntry);
  if (gpxEntries.length === 0) throw new ImportFailure('unsupported');
  const declared = gpxEntries.reduce(
    (total, entry) => total + entry._data.uncompressedSize,
    0,
  );
  if (declared > MAX_IMPORT_BYTES) throw new ImportFailure('too-large');
  const content: GpxContent = { caches: [], parkingAreas: [], sources: [] };
  for (const entry of gpxEntries) {
    const { caches, parkingAreas, sources } = contentOf(
      await textOf(entry),
      entry.name,
    );
    content.caches.push(...caches);
    content.parkingAreas.push(...parkingAreas);
    content.sources.push(...sources);
  }
  return content;
}

async function bytesOf(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new ImportFailure('unreadable');
  }
}

async function contentOfFile(file: File): Promise<GpxContent> {
  assertSupportedName(file.name);
  if (file.size > MAX_IMPORT_BYTES) throw new ImportFailure('too-large');
  const bytes = await bytesOf(file);
  return isArchive(file.name, bytes)
    ? contentOfArchive(bytes)
    : contentOf(new TextDecoder().decode(bytes), file.name);
}

type ImportedContent = GpxContent & { report: ImportedFile };

function refused(file: File, error: ImportFileError): ImportedContent {
  return {
    caches: [],
    parkingAreas: [],
    sources: [],
    report: { name: file.name, cacheCount: 0, error },
  };
}

async function importFile(file: File): Promise<ImportedContent> {
  try {
    const content = await contentOfFile(file);
    const report = { name: file.name, cacheCount: content.caches.length };
    return { ...content, report };
  } catch (error) {
    if (!(error instanceof ImportFailure)) throw error;
    return refused(file, error.code);
  }
}

/** How many caches the import would hold with these added, each code once. */
function cacheCountWith(
  byCode: ReadonlyMap<string, Geocache>,
  caches: readonly Geocache[],
): number {
  const added = caches.filter((cache) => !byCode.has(cache.code));
  return byCode.size + new Set(added.map((cache) => cache.code)).size;
}

/** Reads Pocket Query `.zip` archives and `.gpx` files into caches, one after another, refusing a file that would take the import past MAX_IMPORT_CACHES. */
export async function importFiles(
  files: readonly File[],
): Promise<ImportResult> {
  const byCode = new Map<string, Geocache>();
  const parkingAreas: ParkingArea[] = [];
  const reports: ImportedFile[] = [];
  const sources: string[] = [];
  for (const file of files) {
    const read = await importFile(file);
    // A file that would take the import past the limit is refused whole, so none of its queries counts as read.
    const imported =
      cacheCountWith(byCode, read.caches) > MAX_IMPORT_CACHES
        ? refused(file, 'too-large')
        : read;
    for (const cache of imported.caches) {
      const earlier = byCode.get(cache.code)?.sources ?? [];
      byCode.set(cache.code, {
        ...cache,
        sources: sourcesOf(earlier, cache.sources),
      });
    }
    parkingAreas.push(...imported.parkingAreas);
    reports.push(imported.report);
    sources.push(...imported.sources);
  }
  return {
    caches: withParking([...byCode.values()], parkingAreas),
    files: reports,
    sources: sourcesOf(sources),
  };
}
