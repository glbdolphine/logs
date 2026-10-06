import { LogEntry } from '../types';

export type DupField = 'mac' | 'routerSerial' | 'nmsId';
export interface Duplicate { field: DupField; label: string; value: string; others: LogEntry[]; }

const LABELS: Record<DupField, string> = { mac: 'MAC address', routerSerial: 'Router serial', nmsId: 'NMS ID' };

const norm = (field: DupField, v?: string) => {
  const s = (v || '').trim().toLowerCase();
  return field === 'mac' ? s.replace(/[^0-9a-f]/g, '') : s.replace(/\s+/g, '');
};

/** Other logs that already use the same MAC, router serial or NMS ID. Empty fields are ignored. */
export function findDuplicates(
  entry: Partial<Pick<LogEntry, 'id' | 'mac' | 'routerSerial' | 'nmsId'>>,
  logs: LogEntry[],
): Duplicate[] {
  const out: Duplicate[] = [];
  (['mac', 'routerSerial', 'nmsId'] as DupField[]).forEach((field) => {
    const mine = norm(field, entry[field]);
    if (!mine) return;
    const others = logs.filter((l) => l.id !== entry.id && norm(field, l[field]) === mine);
    if (others.length) out.push({ field, label: LABELS[field], value: (entry[field] || '').trim(), others });
  });
  return out;
}

export const describeLog = (l: LogEntry) =>
  `Log #${l.logNo}${l.customerName ? ` · ${l.customerName}` : ''}${l.resellerName ? ` (${l.resellerName})` : ''}`;
