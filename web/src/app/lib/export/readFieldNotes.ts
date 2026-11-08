import type { FieldNoteEntry } from './fieldNotes';

/** The visits of the file, or why it is not field notes: `line` is the 1-based line that broke it, 0 for the file as a whole. */
export type FieldNotesReading =
  | { entries: FieldNoteEntry[] }
  | { problem: 'not-field-notes' | 'bad-line'; line: number };

const OUTCOMES: Readonly<Record<string, FieldNoteEntry['outcome']>> = {
  'Found it': 'found',
  "Didn't find it": 'dnf',
};

const LINE =
  /^(GC[0-9A-Z]+),(\d{4}-\d\d-\d\dT\d\d:\d\dZ),(Found it|Didn't find it),".*"$/;

const NOT_FIELD_NOTES: FieldNotesReading = {
  problem: 'not-field-notes',
  line: 0,
};

/** The text after a little-endian byte order mark; nothing for any other bytes. */
function decode(bytes: Uint8Array): string | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xfe) return undefined;
  try {
    return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function entryOf(line: string): FieldNoteEntry | undefined {
  const match = LINE.exec(line);
  if (match === null || Number.isNaN(Date.parse(match[2]))) return undefined;
  return { code: match[1], outcome: OUTCOMES[match[3]], at: match[2] };
}

/** Reads a `geocache_visits.txt` back: UTF-16LE with a byte order mark, one Found it or Didn't find it per line; stops at the first line that is neither. */
export function readFieldNotes(bytes: Uint8Array): FieldNotesReading {
  const text = decode(bytes);
  if (text === undefined) return NOT_FIELD_NOTES;
  const entries: FieldNoteEntry[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line === '') continue;
    const entry = entryOf(line);
    if (entry === undefined) return { problem: 'bad-line', line: index + 1 };
    entries.push(entry);
  }
  return entries.length === 0 ? NOT_FIELD_NOTES : { entries };
}
