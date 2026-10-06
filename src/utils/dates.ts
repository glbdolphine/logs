const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const midnight = (y: number, m: number, d: number): Date | null => {
  const dt = new Date(y, m, d);
  // Reject overflow such as 31 Feb.
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d ? dt : null;
};

/**
 * Turns a log's free-text date into a local-midnight Date.
 * Handles "05 Oct 2026" / "5 Sept 2026" (what the log form writes), "05/10/2026" and "05-10-2026"
 * (day first), "2026-10-05", and falls back to Date.parse. Returns null when nothing works.
 */
export function parseLogDate(raw?: string | null): Date | null {
  const s = (raw || '').trim();
  if (!s) return null;

  let m = s.match(/^(\d{1,2})[\s\-\/.,]+([A-Za-z]{3,})\.?[\s\-\/.,]+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon !== undefined) return midnight(+m[3], mon, +m[1]);
  }

  m = s.match(/^(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})$/);
  if (m) return midnight(+m[1], +m[2] - 1, +m[3]);

  m = s.match(/^(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{4})$/);
  if (m) return midnight(+m[3], +m[2] - 1, +m[1]);

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

/** The date a log belongs to: its own date field, else the day it was created. */
export function logDay(log: { date?: string; createdAt?: string }): Date | null {
  return parseLogDate(log.date) || parseLogDate(log.createdAt);
}

/** "2026-10-05" for <input type="date"> */
export const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromIso = (iso: string): Date | null => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? midnight(+m[1], +m[2] - 1, +m[3]) : null;
};

/** "05 Oct 2026" */
export const showDate = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
