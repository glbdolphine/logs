import { LogEntry } from '../types';
import { showDate } from './dates';
import { daysAwaiting } from './forms';

/** Bangladesh-aware: 01712345678 / 1712345678 / +880 1712-345678 -> 8801712345678. Null when it can't be a phone number. */
export function normalizePhone(raw?: string): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('880')) { /* already international */ }
  else if (d.startsWith('0')) d = '880' + d.slice(1);
  else if (d.length === 10 && d.startsWith('1')) d = '880' + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export const waLink = (phone: string, text: string): string | null => {
  const n = normalizePhone(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};

/** Pre-written reminder listing the signed forms still missing (oldest first, max 15 lines). */
export function chaseMessage(resellerName: string, awaiting: LogEntry[]): string {
  const sorted = [...awaiting].sort((a, b) => daysAwaiting(b) - daysAwaiting(a));
  const lines = sorted.slice(0, 15).map((l, i) => {
    const n = daysAwaiting(l);
    const id = l.nmsId ? ` (NMS ${l.nmsId})` : '';
    return `${i + 1}. ${l.customerName || 'Untitled'}${id} - ID given ${l.date || showDate(null)}${n > 0 ? `, ${n} day${n === 1 ? '' : 's'} ago` : ''}`;
  });
  const more = sorted.length > 15 ? `\n...and ${sorted.length - 15} more.` : '';
  const who = (resellerName || '').split('-')[0].trim();
  return [
    `আসসালামু আলাইকুম${who ? ' ' + who : ''},`,
    `Pace IT: we have not yet received the signed form${sorted.length === 1 ? '' : 's'} for the following user ID${sorted.length === 1 ? '' : 's'}. Please send ${sorted.length === 1 ? 'it' : 'them'} as soon as possible.`,
    '',
    lines.join('\n') + more,
    '',
    'Thank you.',
  ].join('\n');
}
