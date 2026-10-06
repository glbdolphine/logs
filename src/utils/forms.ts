import * as XLSX from 'xlsx';
import { LogEntry } from '../types';
import { resellerKey, NO_RESELLER } from './resellerStats';
import { showDate, parseLogDate, logDay } from './dates';

export type FormFilter = 'all' | 'awaiting' | 'received';

/** Every "New User ID" log means one user ID was sent out, so one signed form is expected back. */
export const expectsForm = (l: LogEntry) => /^\s*new user id\s*$/i.test(l.requestType || '');
export const hasForm = (l: LogEntry) => !!l.formReceivedAt;

const OVERDUE_KEY = 'pace_it_form_overdue_days';
/** A signed form is "overdue" once the ID was given this many days ago (editable in the Forms panel). */
export const getOverdueDays = (): number => {
  try { const n = parseInt(localStorage.getItem(OVERDUE_KEY) || '', 10); return n > 0 && n < 365 ? n : 7; } catch { return 7; }
};
export const setOverdueDays = (n: number) => { try { localStorage.setItem(OVERDUE_KEY, String(n)); } catch { /* ignore */ } };

/** Days since the ID was given (0 = today). */
export function daysAwaiting(l: LogEntry, today = new Date()): number {
  const d = logDay(l);
  if (!d) return 0;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((t.getTime() - d.getTime()) / 86400000));
}
export const isFormOverdue = (l: LogEntry, limit = getOverdueDays()) =>
  expectsForm(l) && !hasForm(l) && daysAwaiting(l) >= limit;

/** Logs still waiting for their signed form, grouped by reseller, oldest first. */
export function awaitingByReseller(logs: LogEntry[]): Map<string, LogEntry[]> {
  const m = new Map<string, LogEntry[]>();
  for (const l of logs) {
    if (!expectsForm(l) || hasForm(l)) continue;
    const key = resellerKey(l.resellerName) || NO_RESELLER;
    const arr = m.get(key) || [];
    arr.push(l);
    m.set(key, arr);
  }
  m.forEach((arr) => arr.sort((a, b) => daysAwaiting(b) - daysAwaiting(a)));
  return m;
}

export const normId = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

export interface FormResellerRow { key: string; name: string; sent: number; received: number; }

export function formStats(logs: LogEntry[]) {
  const groups = new Map<string, { names: Map<string, number>; sent: number; received: number }>();
  let sent = 0, received = 0;
  for (const l of logs) {
    if (!expectsForm(l)) continue;
    const key = resellerKey(l.resellerName) || NO_RESELLER;
    const g = groups.get(key) || { names: new Map(), sent: 0, received: 0 };
    const nm = (l.resellerName || '').trim();
    if (nm) g.names.set(nm, (g.names.get(nm) || 0) + 1);
    g.sent++; sent++;
    if (hasForm(l)) { g.received++; received++; }
    groups.set(key, g);
  }
  const rows: FormResellerRow[] = [...groups.entries()].map(([key, g]) => ({
    key, sent: g.sent, received: g.received,
    name: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || NO_RESELLER,
  })).sort((a, b) => (b.sent - b.received) - (a.sent - a.received) || a.name.localeCompare(b.name));
  return { sent, received, awaiting: sent - received, rows };
}

const stamp = () => new Date().toISOString().slice(0, 10);
const shortDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : showDate(d);
};

/** One sheet that works both as a chase-list and as something you can re-import. */
export function exportFormTracker(logs: LogEntry[], onlyAwaiting: boolean): void {
  const forms = logs.filter(expectsForm);
  const list = onlyAwaiting ? forms.filter((l) => !hasForm(l)) : forms;
  const wb = XLSX.utils.book_new();

  const rows = list
    .sort((a, b) => (a.resellerName || '').localeCompare(b.resellerName || '') || Number(a.logNo) - Number(b.logNo))
    .map((l) => ({
      'NMS ID': l.nmsId || '',
      'Customer Name': l.customerName,
      'Reseller': l.resellerName,
      'Log No.': l.logNo,
      'ID Sent On': l.date,
      'Form Received': hasForm(l) ? 'Yes' : 'No',
      'Received On': shortDate(l.formReceivedAt),
    }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 34 }, { wch: 26 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, onlyAwaiting ? 'Awaiting' : 'Forms');

  const st = formStats(logs);
  const sum: (string | number)[][] = [
    ['Reseller', 'IDs sent', 'Forms received', 'Awaiting'],
    ...st.rows.map((r) => [r.name, r.sent, r.received, r.sent - r.received]),
    ['TOTAL', st.sent, st.received, st.awaiting],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(sum);
  ws2['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  XLSX.writeFile(wb, `PaceIT_Forms_${onlyAwaiting ? 'Awaiting' : 'Tracker'}_${stamp()}.xlsx`);
}

export interface ImportPlan {
  toMark: { log: LogEntry; at: string }[];
  already: number;
  notFound: string[];
  rowsRead: number;
}

const YES = /^(y|yes|true|1|✓|✔|x|received|rcvd|done)$/i;

/**
 * Reads an .xlsx/.csv and works out which logs would be marked received. Nothing is changed here.
 * Needs a column with "NMS" in its header. If there is a "Form Received" style column only "Yes" rows count;
 * if there isn't, every NMS ID listed is treated as received. An optional "Received On" column sets the date.
 */
export async function planFormImport(file: File, logs: LogEntry[]): Promise<ImportPlan> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('That file has no sheets.');
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });
  if (!data.length) throw new Error('That file is empty.');

  const heads = Object.keys(data[0]);
  const find = (re: RegExp) => heads.find((h) => re.test(h));
  const idCol = find(/nms/i) || find(/^\s*(customer\s*)?id\s*$/i);
  if (!idCol) throw new Error('Could not find an "NMS ID" column. Add a column with NMS ID in its header.');
  const flagCol = find(/form.*(received|back|return)|^\s*received\s*$/i);
  const dateCol = find(/received\s*on|received\s*date/i);

  const byId = new Map<string, LogEntry[]>();
  for (const l of logs) {
    if (!expectsForm(l) || !normId(l.nmsId)) continue;
    const k = normId(l.nmsId);
    byId.set(k, [...(byId.get(k) || []), l]);
  }

  const plan: ImportPlan = { toMark: [], already: 0, notFound: [], rowsRead: 0 };
  const seen = new Set<string>();
  for (const row of data) {
    const raw = String(row[idCol] ?? '').trim();
    const k = normId(raw);
    if (!k || seen.has(k)) continue;
    if (flagCol && !YES.test(String(row[flagCol]).trim())) continue;
    seen.add(k);
    plan.rowsRead++;
    const hits = byId.get(k);
    if (!hits) { plan.notFound.push(raw); continue; }
    let at = new Date().toISOString();
    if (dateCol && row[dateCol]) {
      const d = parseLogDate(String(row[dateCol]));
      if (d) at = d.toISOString();
    }
    for (const log of hits) {
      if (hasForm(log)) plan.already++;
      else plan.toMark.push({ log, at });
    }
  }
  return plan;
}
