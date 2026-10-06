import { LogEntry } from '../types';


// Fields compared when working out what an edit changed
export const TRACKED_FIELDS: { key: keyof LogEntry; label: string }[] = [
  { key: 'logNo', label: 'Log No.' },
  { key: 'date', label: 'Date' },
  { key: 'resellerName', label: 'Reseller Name' },
  { key: 'callerPhone', label: 'Caller Phone' },
  { key: 'requestType', label: 'Request Type' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'nmsId', label: 'NMS ID / Customer ID' },
  { key: 'issueFound', label: 'Issue Found' },
  { key: 'missingWrongDetails', label: 'Missing / Wrong Details' },
  { key: 'actionTaken', label: 'Action Taken' },
  { key: 'reasonForAction', label: 'REASON for Action' },
  { key: 'resellerInformed', label: 'Reseller Informed?' },
  { key: 'followUpNeeded', label: 'Follow-up Needed?' },
  { key: 'status', label: 'Status' },
  { key: 'supervisorInformed', label: 'Supervisor Informed / Approved By' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'mac', label: 'Mac' },
  { key: 'edcNo', label: 'EDC Book No.' },
  { key: 'routerSerial', label: 'Router Serial No.' },
  { key: 'followUpDate', label: 'Follow-up date' },
  { key: 'formReceivedAt', label: 'Signed form received' },
];

const clip = (value: string) => (value.length > 200 ? value.slice(0, 200) + '…' : value);

export function diffLogs(before: LogEntry, after: LogEntry) {
  const changes: { field: string; from: string; to: string }[] = [];
  for (const { key, label } of TRACKED_FIELDS) {
    const from = String(before[key] ?? '').trim();
    const to = String(after[key] ?? '').trim();
    if (from !== to) {
      changes.push({ field: label, from: clip(from), to: clip(to) });
    }
  }
  return changes;
}

export function formatStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
