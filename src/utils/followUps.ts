import { LogEntry } from '../types';
import { fromIso, toIso } from './dates';

export type FollowState = 'overdue' | 'today' | 'upcoming' | null;
export type FollowFilter = 'all' | 'today' | 'overdue';

export const isClosedStatus = (s = '') => /resolved|closed|cancel/i.test(s);

export const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

/** Whole days from today to the follow-up date (negative = overdue). null when no usable date. */
export function followDiff(l: Pick<LogEntry, 'followUpDate' | 'status'>, today = startOfToday()): number | null {
  if (!l.followUpDate || isClosedStatus(l.status)) return null;
  const d = fromIso(l.followUpDate);
  return d ? Math.round((d.getTime() - today.getTime()) / 86400000) : null;
}

export function followState(l: Pick<LogEntry, 'followUpDate' | 'status'>, today = startOfToday()): FollowState {
  const n = followDiff(l, today);
  if (n === null) return null;
  return n < 0 ? 'overdue' : n === 0 ? 'today' : 'upcoming';
}

export function followLabel(l: Pick<LogEntry, 'followUpDate' | 'status'>, today = startOfToday()): string {
  const n = followDiff(l, today);
  if (n === null) return '';
  if (n === 0) return 'Follow-up today';
  if (n < 0) return `Overdue ${-n}d`;
  return n === 1 ? 'Follow-up tomorrow' : `Follow-up in ${n}d`;
}

export const addDaysIso = (days: number) => {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  return toIso(d);
};
