import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LogEntry } from '../types';

/**
 * Exports a single Log Entry as a high-fidelity PDF sheet matching the exact
 * layout, header, navy left column, and field names from the Reseller Request Log document.
 */
export function exportSingleLogPdf(log: LogEntry): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(24, 49, 83); // brand navy
  const titleText = 'Reseller Request Log - New User ID & Forms';
  const textWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (pageWidth - textWidth) / 2, 22);

  // Subtitle / Log No.
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Log No. ${log.logNo}`, 14, 34);

  // Table rows matching the exact order from the document
  const rows = [
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

  autoTable(doc, {
    startY: 38,
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: 3.5,
      lineColor: [203, 213, 225], // slate-300
      lineWidth: 0.25,
      textColor: [30, 41, 59], // slate-800
      valign: 'middle',
    },
    columnStyles: {
      0: {
        fillColor: [24, 49, 83], // Dark Navy Blue matching document
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        cellWidth: 62,
      },
      1: {
        fillColor: [255, 255, 255],
        textColor: [30, 41, 59],
        cellWidth: 'auto',
      },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
    didDrawPage: (data) => {
      // Quiet footer with app name & generation timestamp
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      const footerText = `Pace IT · Log No. ${log.logNo} · Exported on ${new Date().toLocaleDateString()}`;
      doc.text(footerText, 14, doc.internal.pageSize.getHeight() - 10);
    },
  });

  const sanitizedCustomer = (log.customerName || 'Log')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 25);
  doc.save(`PaceIT_Log_${log.logNo}_${sanitizedCustomer}.pdf`);
}

/**
 * Exports all or filtered log entries into a comprehensive tabular PDF report
 */
export function exportBatchLogsPdf(logs: LogEntry[], reportTitle = 'Reseller Request Logs Report'): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Records: ${logs.length} · Generated: ${new Date().toLocaleString()} · Pace IT`, 14, 25);

  const tableHeaders = [
    'Log #',
    'Date',
    'Reseller Name',
    'Customer Name',
    'NMS ID',
    'Request Type',
    'Issue Found',
    'Action Taken',
    'Status',
    'MAC',
  ];

  const tableData = logs.map((item) => [
    `#${item.logNo}`,
    item.date || '',
    item.resellerName || '',
    item.customerName || '',
    item.nmsId || '',
    item.requestType || '',
    item.issueFound || '',
    item.actionTaken || '',
    item.status || '',
    item.mac || '',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [tableHeaders],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [24, 49, 83], // Pace IT Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    },
  });

  doc.save(`PaceIT_Reseller_Logs_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
