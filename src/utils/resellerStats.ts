import { LogEntry } from '../types';
import { logDay } from './dates';

export const NO_RESELLER = '(No reseller)';
export const ALL_TYPES = '__all__';

export interface ResellerRow {
  key: string;
  name: string;
  count: number;
  pending: number;
  resolved: number;
  first: Date | null;
  last: Date | null;
  logs: LogEntry[];
}

// "Shabul- Balaganj", "shabul - balaganj" and "Shabul -Balaganj" are the same reseller.
export const resellerKey = (name?: string) =>
  (name || '').toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();

const isPending = (s = '') => /pending|waiting/i.test(s);
const isResolved = (s = '') => /resolved|closed/i.test(s);

export interface StatsOptions {
  from: Date | null;   // inclusive
  to: Date | null;     // inclusive
  requestType: string; // a request type, or ALL_TYPES
}

export function buildResellerStats(logs: LogEntry[], { from, to, requestType }: StatsOptions) {
  const type = requestType.trim().toLowerCase();
  const groups = new Map<string, { names: Map<string, number>; logs: LogEntry[] }>();
  let undated = 0;

  for (const log of logs) {
    if (requestType !== ALL_TYPES && (log.requestType || '').trim().toLowerCase() !== type) continue;

    const day = logDay(log);
    if ((from || to) && !day) { undated++; continue; }
    if (day && from && day < from) continue;
    if (day && to && day > to) continue;

    const key = resellerKey(log.resellerName) || NO_RESELLER;
    const g = groups.get(key) || { names: new Map<string, number>(), logs: [] as LogEntry[] };
    const shown = (log.resellerName || '').trim();
    if (shown) g.names.set(shown, (g.names.get(shown) || 0) + 1);
    g.logs.push(log);
    groups.set(key, g);
  }

  const rows: ResellerRow[] = [...groups.entries()].map(([key, g]) => {
    // Show the spelling used most often.
    const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || NO_RESELLER;
    const days = g.logs.map(logDay).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
    return {
      key, name,
      count: g.logs.length,
      pending: g.logs.filter((l) => isPending(l.status)).length,
      resolved: g.logs.filter((l) => isResolved(l.status)).length,
      first: days[0] || null,
      last: days[days.length - 1] || null,
      logs: g.logs,
    };
  });

  const total = rows.reduce((n, r) => n + r.count, 0);
  return { rows, total, undated };
}
