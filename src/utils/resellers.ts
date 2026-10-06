import { LogEntry, Reseller } from '../types';
import { resellerKey } from './resellerStats';

/** The reseller a log belongs to: by id when saved from the list, else by (spelling-insensitive) name. */
export function matchReseller(
  log: Pick<LogEntry, 'resellerId' | 'resellerName'>,
  resellers: Reseller[],
): Reseller | null {
  if (log.resellerId) {
    const byId = resellers.find((r) => r.id === log.resellerId);
    if (byId) return byId;
  }
  const key = resellerKey(log.resellerName);
  return key ? resellers.find((r) => resellerKey(r.name) === key) || null : null;
}

/** Best phone number to reach the reseller about this log. */
export const phoneForLog = (log: LogEntry, resellers: Reseller[]) =>
  matchReseller(log, resellers)?.phone || log.callerPhone || '';
