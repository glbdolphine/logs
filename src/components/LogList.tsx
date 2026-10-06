import React, { useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { LogEntry, Reseller } from '../types';
import { LogSheetView } from './LogSheetView';
import type { ViewMode } from './LogsToolbar';
import { expectsForm, hasForm, daysAwaiting, getOverdueDays } from '../utils/forms';
import { followState, followLabel } from '../utils/followUps';
import { phoneForLog } from '../utils/resellers';
import { chaseMessage, waLink } from '../utils/whatsapp';

const tone = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('resolved') || s.includes('closed')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s.includes('progress')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (s.includes('pending') || s.includes('waiting')) return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const Badge: React.FC<{ status?: string }> = ({ status }) => (
  <span className={`inline-block max-w-full truncate px-2 py-0.5 text-[10px] font-semibold rounded-full border ${tone(status)}`}>
    {status || '—'}
  </span>
);

const FormChip: React.FC<{ log: LogEntry; onToggle: (l: LogEntry) => void; resellers: Reseller[] }> = ({ log, onToggle, resellers }) => {
  if (!expectsForm(log)) return null;
  const got = hasForm(log);
  const days = got ? 0 : daysAwaiting(log);
  const overdue = !got && days >= getOverdueDays();
  const wa = got ? null : waLink(phoneForLog(log, resellers), chaseMessage(log.resellerName, [log]));
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span role="button" tabIndex={0} title={got ? 'Form received - click to undo' : 'Click to mark form received'}
        onClick={(e) => { e.stopPropagation(); onToggle(log); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggle(log); } }}
        className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full border cursor-pointer ${
          got ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : overdue ? 'bg-rose-100 text-rose-800 border-rose-300'
            : 'bg-white text-slate-500 border-slate-300 border-dashed hover:bg-brand-50'}`}>
        {got ? '✓ Form received' : `○ Form awaited${days > 0 ? ` · ${days}d` : ''}${overdue ? ' · overdue' : ''}`}
      </span>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          title="Remind the reseller on WhatsApp"
          className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50">
          WhatsApp
        </a>
      )}
    </span>
  );
};

const FollowChip: React.FC<{ log: LogEntry }> = ({ log }) => {
  const st = followState(log);
  if (!st) return null;
  const cls = st === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-300'
    : st === 'today' ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`inline-block shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cls}`}>{followLabel(log)}</span>;
};

const rowProps = (onOpen: () => void) => ({
  role: 'button' as const, tabIndex: 0, onClick: onOpen,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } },
});

interface ListProps { logs: LogEntry[]; mode: ViewMode; resellers: Reseller[]; onOpen: (log: LogEntry) => void; onToggleForm: (log: LogEntry) => void; }

export const LogList: React.FC<ListProps> = ({ logs, mode, resellers, onOpen, onToggleForm }) => {
  if (mode === 'card') {
    return (
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {logs.map((l) => (
          <div key={l.id} id={`item-${l.id}`} {...rowProps(() => onOpen(l))}
            className="cursor-pointer text-left bg-white rounded-2xl border border-brand-100 p-4 shadow-sm hover:shadow-md hover:border-brand-300 transition scroll-mt-40 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5">#{l.logNo}</span>
              <Badge status={l.status} />
            </div>
            <div className="font-semibold text-slate-900 leading-snug break-words">{l.customerName || 'Untitled'}</div>
            <div className="text-xs text-slate-500 break-words">{[l.resellerName, l.callerPhone].filter(Boolean).join(' · ')}</div>
            {l.issueFound && <p className="text-xs text-slate-600 line-clamp-2 break-words">{l.issueFound}</p>}
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-slate-100">
              <span className="truncate">{l.requestType}</span>
              <span className="font-mono shrink-0">{l.nmsId || l.date}</span>
            </div>
            {(expectsForm(l) || followState(l)) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <FormChip log={l} onToggle={onToggleForm} resellers={resellers} />
                <FollowChip log={l} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const cols = 'grid-cols-[3rem_minmax(0,1fr)_auto_1rem] md:grid-cols-[3.5rem_6.5rem_1.2fr_1.8fr_1fr_6.5rem_6.5rem_15rem_1rem]';
  return (
    <div className="no-print bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      <div className={`hidden md:grid ${cols} gap-x-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-brand-800 bg-brand-50 border-b border-brand-100`}>
        <span>#</span><span>Date</span><span>Reseller</span><span>Customer</span><span>Request</span><span>NMS ID</span><span>Status</span><span>Form</span><span />
      </div>
      {logs.map((l) => (
        <div key={l.id} id={`item-${l.id}`} {...rowProps(() => onOpen(l))}
          className={`cursor-pointer w-full text-left grid ${cols} gap-x-3 items-center px-3 md:px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-brand-50 transition-colors scroll-mt-40 text-sm`}>
          <span className="font-mono text-xs font-semibold text-brand-700">#{l.logNo}</span>
          <span className="md:hidden min-w-0">
            <span className="block font-semibold text-slate-900 truncate">{l.customerName || 'Untitled'}</span>
            <span className="block text-xs text-slate-500 truncate">{[l.resellerName, l.date].filter(Boolean).join(' · ')}</span>
            {followState(l) && <span className="mt-1 block"><FollowChip log={l} /></span>}
          </span>
          <span className="hidden md:block text-xs text-slate-600">{l.date}</span>
          <span className="hidden md:block truncate text-slate-700">{l.resellerName}</span>
          <span className="hidden md:flex items-center gap-1.5 min-w-0">
            <span className="truncate font-semibold text-slate-900">{l.customerName}</span>
            <FollowChip log={l} />
          </span>
          <span className="hidden md:block truncate text-xs text-slate-600">{l.requestType}</span>
          <span className="hidden md:block truncate font-mono text-xs text-slate-600">{l.nmsId}</span>
          <Badge status={l.status} />
          <span className="hidden md:block"><FormChip log={l} onToggle={onToggleForm} resellers={resellers} /></span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      ))}
    </div>
  );
};

interface ModalProps {
  log: LogEntry | null;
  onClose: () => void;
  onEdit: (log: LogEntry) => void;
  onDuplicate: (log: LogEntry) => void;
  onDelete: (id: string) => void;
  onToggleForm: (log: LogEntry) => void;
}

export const LogDetailModal: React.FC<ModalProps> = ({ log, onClose, onEdit, onDuplicate, onDelete, onToggleForm }) => {
  useEffect(() => {
    if (!log) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [log, onClose]);
  if (!log) return null;
  return (
    <div className="log-modal-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="log-modal-panel max-w-4xl mx-auto bg-[#eef8f1] min-h-full sm:min-h-0 sm:rounded-2xl shadow-2xl p-3 sm:p-5">
        <div className="no-print flex justify-end mb-2">
          <button onClick={onClose} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-brand-100 rounded-full hover:bg-brand-50">
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
        <LogSheetView log={log} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} onToggleForm={onToggleForm} />
      </div>
    </div>
  );
};
