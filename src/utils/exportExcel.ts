import * as XLSX from 'xlsx';
import { LogEntry } from '../types';
import type { ResellerRow } from './resellerStats';

/**
 * Export multiple logs to an Excel (.xlsx) spreadsheet
 */
export function exportBatchLogsExcel(logs: LogEntry[], filenamePrefix = 'PaceIT_Reseller_Logs'): void {
  const wb = XLSX.utils.book_new();

  // Map rows with clean, human-readable column headers matching the document
  const rows = logs.map((log) => ({
    'Log No.': log.logNo,
    'Date': log.date,
    'Reseller Name': log.resellerName,
    'Caller Phone': log.callerPhone,
    'Request Type': log.requestType,
    'Customer Name': log.customerName,
    'NMS ID / Customer ID': log.nmsId || '',
    'Issue Found': log.issueFound,
    'Missing / Wrong Details': log.missingWrongDetails,
    'Action Taken': log.actionTaken,
    'REASON for Action (why I did it)': log.reasonForAction,
    'Reseller Informed?': log.resellerInformed,
    'Follow-up Needed?': log.followUpNeeded,
    'Status': log.status,
    'Supervisor Informed / Approved By': log.supervisorInformed,
    'Remarks': log.remarks,
    'Mac Address': log.mac,
    'EDC Book No.': log.edcNo || '',
    'Router Serial No.': log.routerSerial || '',
    'Signed Form Received On': log.formReceivedAt ? log.formReceivedAt.slice(0, 10) : '',
    'Created At': log.createdAt,
    'Created By': log.createdBy || '',
    'Last Edited By': log.updatedBy || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set appropriate column widths for clean readability in Excel
  ws['!cols'] = [
    { wch: 8 },  // Log No.
    { wch: 14 }, // Date
    { wch: 22 }, // Reseller Name
    { wch: 18 }, // Caller Phone
    { wch: 18 }, // Request Type
    { wch: 32 }, // Customer Name
    { wch: 20 }, // NMS ID / Customer ID
    { wch: 30 }, // Issue Found
    { wch: 40 }, // Missing / Wrong Details
    { wch: 40 }, // Action Taken
    { wch: 45 }, // REASON for Action
    { wch: 18 }, // Reseller Informed
    { wch: 18 }, // Follow-up Needed
    { wch: 26 }, // Status
    { wch: 30 }, // Supervisor Informed
    { wch: 45 }, // Remarks
    { wch: 20 }, // Mac
    { wch: 14 }, // EDC
    { wch: 18 }, // Router
    { wch: 16 }, // Form received
    { wch: 22 }, // Created At
    { wch: 18 }, // Created By
    { wch: 18 }, // Last Edited By
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Reseller Logs');

  const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export a single log to an Excel (.xlsx) file as a key-value form sheet
 */
export function exportSingleLogExcel(log: LogEntry): void {
  const wb = XLSX.utils.book_new();

  const data = [
    ['Reseller Request Log - New User ID & Forms', ''],
    [`Log No. ${log.logNo}`, ''],
    ['Field', 'Recorded Details'],
    ['Date', log.date || ''],
    ['Reseller Name', log.resellerName || ''],
    ['Caller Phone', log.callerPhone || ''],
    ['Request Type', log.requestType || ''],
    ['Customer Name', log.customerName || ''],
    ['NMS ID / Customer ID', log.nmsId || ''],
    ['Issue Found', log.issueFound || ''],
    ['Missing / Wrong Details', log.missingWrongDetails || ''],
    ['Action Taken', log.actionTaken || ''],
    ['REASON for Action (why I did it)', log.reasonForAction || ''],
    ['Reseller Informed?', log.resellerInformed || ''],
    ['Follow-up Needed?', log.followUpNeeded || ''],
    ['Status', log.status || ''],
    ['Supervisor Informed / Approved By', log.supervisorInformed || ''],
    ['Remarks', log.remarks || ''],
    ['Mac', log.mac || ''],
    ['EDC Book No.', log.edcNo || ''],
    ['Router Serial No.', log.routerSerial || ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 35 },
    { wch: 65 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Log_${log.logNo}`);

  const sanitizedCustomer = (log.customerName || 'Log')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 20);
  XLSX.writeFile(wb, `PaceIT_Log_${log.logNo}_${sanitizedCustomer}.xlsx`);
}

/**
 * Export the reseller supply report: one summary sheet and one sheet listing every entry counted.
 */
export function exportResellerSupplyExcel(rows: ResellerRow[], rangeLabel: string, typeLabel: string): void {
  const wb = XLSX.utils.book_new();
  const total = rows.reduce((n, r) => n + r.count, 0);

  const summary: (string | number)[][] = [
    ['Pace IT - Reseller Supply Report', ''],
    ['Counting', typeLabel],
    ['Date range', rangeLabel],
    ['Generated', new Date().toLocaleString()],
    ['', ''],
    ['Reseller', 'Count', 'Pending', 'Resolved', 'First date', 'Last date'],
    ...rows.map((r) => [
      r.name, r.count, r.pending, r.resolved,
      r.first ? r.first.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      r.last ? r.last.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    ]),
    ['TOTAL', total, '', '', '', ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Supply Summary');

  const detail = rows.flatMap((r) => r.logs.map((l) => ({
    'Reseller': r.name,
    'Log No.': l.logNo,
    'Date': l.date,
    'Request Type': l.requestType,
    'Customer Name': l.customerName,
    'NMS ID / Customer ID': l.nmsId || '',
    'EDC Book No.': l.edcNo || '',
    'Status': l.status,
  })));
  const ws2 = XLSX.utils.json_to_sheet(detail);
  ws2['!cols'] = [{ wch: 26 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 34 }, { wch: 20 }, { wch: 14 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Entries');

  XLSX.writeFile(wb, `PaceIT_Reseller_Supply_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
