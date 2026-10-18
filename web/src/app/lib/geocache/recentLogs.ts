import type { RecentLog, RecentLogType } from './types';

export const MAX_RECENT_LOGS = 5;

/** A log as the file writes it: its type text and its date-time text. */
export interface LogEntry {
  type: string;
  date: string;
}

// Owner Maintenance, Enable Listing and the like fall to 'other': they clear a problem rather than report one.
const LOG_TYPES: ReadonlyMap<string, RecentLogType> = new Map([
  ['found it', 'found'],
  ['attended', 'found'],
  ['webcam photo taken', 'found'],
  ["didn't find it", 'dnf'],
  ['write note', 'note'],
  ['needs maintenance', 'maintenance'],
  ['needs archived', 'maintenance'],
  ['temporarily disable listing', 'disabled'],
]);

const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;

function logTypeOf(text: string): RecentLogType {
  const key = text.trim().toLowerCase().replaceAll('’', "'");
  return LOG_TYPES.get(key) ?? 'other';
}

/** The newest logs first, at most five; a log without a readable date is dropped. */
export function recentLogsOf(entries: readonly LogEntry[]): RecentLog[] {
  const logs: RecentLog[] = [];
  for (const entry of entries) {
    const date = ISO_DATE.exec(entry.date.trim())?.[1];
    if (date !== undefined) logs.push({ type: logTypeOf(entry.type), date });
  }
  // Stable: logs of the same day keep the file's order, which exporters write newest first.
  logs.sort((a, b) => b.date.localeCompare(a.date));
  return logs.slice(0, MAX_RECENT_LOGS);
}
