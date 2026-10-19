import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildZip } from './gpx.test-support';

// importFiles.ts enforces its size limits through two JSZip details the typings leave out (issue #12).
const CHANGED =
  'JSZip internals changed, see issue #12 and docs/how-to/developer-guide.md';

const CONTENT = '<gpx>synthetic</gpx>';

async function loadedEntry(): Promise<Record<string, unknown>> {
  const archive = await JSZip.loadAsync(
    await buildZip({ 'caches.gpx': CONTENT }),
  );
  return archive.files['caches.gpx'] as unknown as Record<string, unknown>;
}

describe('the JSZip internals importFiles relies on', () => {
  it('keeps the declared uncompressed size of a loaded entry on _data', async () => {
    const entry = await loadedEntry();
    const data = entry._data as { uncompressedSize?: unknown } | undefined;

    expect(data?.uncompressedSize, CHANGED).toBe(
      new TextEncoder().encode(CONTENT).length,
    );
  });

  it('streams a loaded entry through internalStream', async () => {
    const entry = await loadedEntry();
    expect(typeof entry.internalStream, CHANGED).toBe('function');
    const stream = (
      entry.internalStream as (type: 'uint8array') => {
        on(event: string, listener: (chunk: Uint8Array) => void): unknown;
        resume(): void;
      }
    )('uint8array');

    const text = await new Promise<string>((resolve, reject) => {
      const decoder = new TextDecoder();
      let read = '';
      stream.on('data', (chunk) => (read += decoder.decode(chunk)));
      stream.on('error', () => reject(new Error(CHANGED)));
      stream.on('end', () => resolve(read));
      stream.resume();
    });

    expect(text, CHANGED).toBe(CONTENT);
  });
});
