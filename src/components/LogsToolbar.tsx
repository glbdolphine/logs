import React, { useState } from 'react';
import { LogEntry } from '../types';
import { Search, FileText, FileSpreadsheet, Printer, List, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { exportBatchLogsPdf } from '../utils/exportPdf';
import { exportBatchLogsExcel } from '../utils/exportExcel';
import { FormsPanel } from './FormsPanel';
import type { FormFilter, ImportPlan } from '../utils/forms';
import type { FollowFilter } from '../utils/followUps';
import type { Reseller } from '../types';

export type StatusFilter = 'all' | 'pending' | 'in_progress' | 'resolved';
export type ViewMode = 'list' | 'card';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

interface LogsToolbarProps {
  totalCount: number;
  filteredLogs: LogEntry[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  onJumpToLog: (id: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrintAll: () => void;
  allLogs: LogEntry[];
  formFilter: FormFilter;
  onFormFilterChange: (f: FormFilter) => void;
  onPickFormReseller: (name: string) => void;
  onApplyFormImport: (plan: ImportPlan) => Promise<void>;
  resellers: Reseller[];
  followFilter: FollowFilter;
  onFollowFilterChange: (f: FollowFilter) => void;
  followCounts: { today: number; overdue: number };
}

export const LogsToolbar: React.FC<LogsToolbarProps> = ({
  totalCount, filteredLogs, searchTerm, onSearchChange, statusFilter, onStatusFilterChange,
  onJumpToLog, viewMode, onViewModeChange, onPrintAll,
  allLogs, formFilter, onFormFilterChange, onPickFormReseller, onApplyFormImport,
  resellers, followFilter, onFollowFilterChange, followCounts,
}) => {
  const [showTools, setShowTools] = useState(false);
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-brand-100 hover:bg-brand-50 rounded-full transition-colors disabled:opacity-40';
  const none = filteredLogs.length === 0;

  return (
    <div className="no-print bg-white/90 backdrop-blur border-b border-brand-100 px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[160px] md:flex-none md:w-80">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search logs..."
          className="w-full h-10 md:h-9 pl-9 pr-3 text-sm bg-[#e8eefb] border border-transparent rounded-full focus:outline-none focus:bg-white focus:border-brand-600 transition-colors placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-center bg-brand-50 p-0.5 rounded-full border border-brand-100" role="group" aria-label="View mode">
        {([['list', List, 'List'], ['card', LayoutGrid, 'Cards']] as const).map(([k, Icon, label]) => (
          <button key={k} type="button" onClick={() => onViewModeChange(k)} aria-pressed={viewMode === k}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              viewMode === k ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-brand-800'}`}>
            <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <FormsPanel logs={allLogs} resellers={resellers} formFilter={formFilter} onFormFilter={onFormFilterChange}
        onPickReseller={onPickFormReseller} onApplyImport={onApplyFormImport} />

      <button type="button" onClick={() => setShowTools((v) => !v)} aria-expanded={showTools}
        className={`md:hidden p-2.5 rounded-full border ${showTools ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-brand-100'}`}
        aria-label="More tools"><SlidersHorizontal className="w-4 h-4" /></button>

      <div className="basis-full md:basis-auto flex items-center bg-brand-50 p-0.5 rounded-full border border-brand-100 text-xs overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => onStatusFilterChange(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full transition-colors ${
              statusFilter === f.key ? 'bg-white text-brand-800 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="basis-full md:basis-auto flex items-center bg-brand-50 p-0.5 rounded-full border border-brand-100 text-xs overflow-x-auto" role="group" aria-label="Follow-up filter">
        {([['all', 'Any follow-up', 0], ['today', 'Due today', followCounts.today], ['overdue', 'Overdue', followCounts.overdue]] as const).map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => onFollowFilterChange(k)}
            className={`shrink-0 px-3 py-1.5 rounded-full transition-colors ${
              followFilter === k ? 'bg-white text-brand-800 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}{k !== 'all' && n > 0 && <span className={`ml-1 font-mono ${k === 'overdue' ? 'text-rose-600' : 'text-amber-600'}`}>{n}</span>}
          </button>
        ))}
      </div>

      <div className={`${showTools ? 'flex' : 'hidden'} md:flex basis-full md:basis-auto md:flex-1 flex-wrap items-center md:justify-end gap-2`}>
        <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
          {filteredLogs.length === totalCount ? `${totalCount} logs` : `${filteredLogs.length} of ${totalCount} logs`}
        </span>
        {!none && (
          <select value="" onChange={(e) => e.target.value && onJumpToLog(e.target.value)}
            className="max-w-[200px] text-slate-900 bg-white border border-brand-100 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-brand-600">
            <option value="">Open log...</option>
            {filteredLogs.map((item) => (
              <option key={item.id} value={item.id}>
                #{item.logNo} — {item.customerName || item.resellerName || 'Untitled'}{item.nmsId ? ` (${item.nmsId})` : ''}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={onPrintAll} disabled={none} className={btn} title="Print all logs shown">
          <Printer className="w-3.5 h-3.5" /><span>Print all</span>
        </button>
        <button type="button" onClick={() => exportBatchLogsExcel(filteredLogs)} disabled={none} className={btn}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /><span>Excel</span>
        </button>
        <button type="button" onClick={() => exportBatchLogsPdf(filteredLogs)} disabled={none} className={btn}>
          <FileText className="w-3.5 h-3.5 text-brand-700" /><span>PDF</span>
        </button>
      </div>
    </div>
  );
};
