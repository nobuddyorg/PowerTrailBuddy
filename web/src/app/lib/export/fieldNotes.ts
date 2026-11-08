export interface FieldNoteEntry {
  code: string;
  outcome: 'found' | 'dnf';
  /** ISO date-time. */
  at: string;
}

const LOG_TYPES: Readonly<Record<FieldNoteEntry['outcome'], string>> = {
  found: 'Found it',
  dnf: "Didn't find it",
};

const BYTE_ORDER_MARK = 0xfeff;

/** YYYY-MM-DDTHH:MMZ in UTC, as Geocaching.com's drafts upload reads it; throws on an unreadable time. */
function minuteOf(at: string): string {
  return `${new Date(at).toISOString().slice(0, 16)}Z`;
}

/** One line without a double quote, which would end the quoted text early in the drafts upload. */
function quotableText(message: string): string {
  return message
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .trim();
}

function utf16LittleEndian(text: string): Uint8Array {
  return Uint8Array.from(
    text.split('').flatMap((unit) => {
      const code = unit.charCodeAt(0);
      return [code & 0xff, code >> 8];
    }),
  );
}

/** A `geocache_visits.txt` for Geocaching.com's drafts upload: UTF-16LE with BOM, CRLF lines, oldest first, every log carrying `message`. */
export function buildFieldNotes(
  entries: readonly FieldNoteEntry[],
  message = '',
): Uint8Array {
  const text = quotableText(message);
  const lines = entries
    .map((entry) => ({ ...entry, minute: minuteOf(entry.at) }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map(
      (entry) =>
        `${entry.code},${entry.minute},${LOG_TYPES[entry.outcome]},"${text}"\r\n`,
    );
  return utf16LittleEndian(
    String.fromCharCode(BYTE_ORDER_MARK) + lines.join(''),
  );
}
