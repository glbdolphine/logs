import React, { useMemo, useState } from 'react';
import { Search, FileSpreadsheet, ChevronDown, ChevronRight, Users, Hash, Trophy, CalendarRange } from 'lucide-react';
import { LogEntry } from '../types';
import { fromIso, logDay, showDate, toIso } from '../utils/dates';
import { ALL_TYPES, buildResellerStats } from '../utils/resellerStats';
import { exportResellerSupplyExcel } from '../utils/exportExcel';
import { expectsForm, hasForm } from '../utils/forms';

interface Props {
  logs: LogEntry[];
  onOpenLog: (id: string) => void;
}

const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
const pill = 'shrink-0 px-3 py-1.5 text-xs rounded-full border border-brand-100 bg-white text-slate-600 hover:bg-brand-50 hover:text-brand-800 transition-colors';

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: 'all', label: 'All time', range: () => ['', ''] },
  { key: 'month', label: 'This month', range: () => {
    const n = new Date(); return [toIso(new Date(n.getFullYear(), n.getMonth(), 1)), toIso(n)];
  } },
  { key: 'last30', label: 'Last 30 days', range: () => {
    const n = new Date(); return [toIso(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), toIso(n)];
  } },
  { key: 'year', label: 'This year', range: () => {
    const n = new Date(); return [toIso(new Date(n.getFullYear(), 0, 1)), toIso(n)];
  } },
];

export const ResellerSupply: React.FC<Props> = ({ logs, onOpenLog }) => {
  const [fromIsoStr, setFrom] = useState('');
  const [toIsoStr, setTo] = useState('');
  const [requestType, setRequestType] = useState('New User ID');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [open, setOpen] = useState<string | null>(null);

  const from = fromIso(fromIsoStr);
  const to = fromIso(toIsoStr);
  const rangeBad = Boolean(from && to && from > to);

  const types = useMemo(() => {
    const seen = new Map<string, string>();
    seen.set('new user id', 'New User ID');
    for (const l of logs) {
      const t = (l.requestType || '').trim();
      if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
    return [...seen.values()];
  }, [logs]);

  const { rows, total, undated } = useMemo(
    () => buildResellerStats(logs, { from: rangeBad ? null : from, to: rangeBad ? null : to, requestType }),
    [logs, fromIsoStr, toIsoStr, requestType, rangeBad],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
    return [...list].sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name) : b.count - a.count || a.name.localeCompare(b.name));
  }, [rows, query, sortBy]);

  const max = Math.max(1, ...rows.map((r) => r.count));
  const top = [...rows].sort((a, b) => b.count - a.count)[0];
  const typeLabel = requestType === ALL_TYPES ? 'All requests' : requestType;
  const rangeLabel = from || to ? `${from ? showDate(from) : 'Start'} to ${to ? showDate(to) : 'Today'}` : 'All time';
  const activePreset = PRESETS.find((p) => { const [a, b] = p.range(); return a === fromIsoStr && b === toIsoStr; })?.key;

  const applyPreset = (p: (typeof PRESETS)[number]) => { const [a, b] = p.range(); setFrom(a); setTo(b); };

  return (
    <div className="w-full space-y-4">
      <div className="pb-3 border-b border-slate-200 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">Reseller Supply</h1>
          <p className="text-xs text-slate-500 mt-0.5">How many {requestType === ALL_TYPES ? 'requests' : `"${requestType}" entries`} each reseller has taken from Pace IT, for any date range.</p>
        </div>
        <button type="button" disabled={shown.length === 0} onClick={() => exportResellerSupplyExcel(shown, rangeLabel, typeLabel)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-brand-100 hover:bg-brand-50 rounded-full transition-colors disabled:opacity-40">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /><span>Excel</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-brand-100 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-medium text-slate-600">From date
            <input type="date" className={`${inputCls} mt-1`} value={fromIsoStr} max={toIsoStr || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-600">To date
            <input type="date" className={`${inputCls} mt-1`} value={toIsoStr} min={fromIsoStr || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-600">Counting
            <select className={`${inputCls} mt-1`} value={requestType} onChange={(e) => setRequestType(e.target.value)}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value={ALL_TYPES}>All request types</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">Find reseller
            <span className="relative block mt-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-8`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reseller name..." />
            </span>
          </label>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPreset(p)}
              className={`${pill} ${activePreset === p.key ? '!bg-brand-600 !text-white !border-brand-600 font-semibold' : ''}`}>{p.label}</button>
          ))}
        </div>

        {rangeBad && <div className="text-xs px-3 py-2 border rounded bg-red-50 text-red-700 border-red-200">The From date is after the To date, so the dates are ignored until you fix it.</div>}
        {undated > 0 && <div className="text-xs px-3 py-2 border rounded bg-slate-50 text-slate-700 border-slate-200">{undated} {undated === 1 ? 'entry has' : 'entries have'} a date the system could not read, so {undated === 1 ? 'it is' : 'they are'} left out of this date range.</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          [Hash, total, `${typeLabel} in range`],
          [Users, rows.length, 'Resellers in range'],
          [Trophy, top ? top.count : 0, top ? `Most: ${top.name}` : 'Most: —'],
        ] as const).map(([Icon, value, label], i) => (
          <div key={i} className="bg-white rounded-2xl border border-brand-100 p-4 flex items-center gap-3">
            <span className="p-2 rounded-full bg-brand-50 text-brand-700"><Icon className="w-4 h-4" /></span>
            <div className="min-w-0">
              <div className="font-display text-xl font-bold text-brand-700 leading-none">{value}</div>
              <div className="text-[11px] text-slate-500 mt-1 truncate">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between gap-2 text-[11px] bg-brand-50 border-b border-brand-100">
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-brand-800"><CalendarRange className="w-3.5 h-3.5" />{rangeLabel}</span>
          <div className="flex items-center bg-white p-0.5 rounded-full border border-brand-100 text-xs">
            {(['count', 'name'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSortBy(k)}
                className={`px-2.5 py-1 rounded-full transition-colors ${sortBy === k ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'}`}>
                {k === 'count' ? 'Most first' : 'A to Z'}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12 px-4">{logs.length === 0 ? 'No logs yet.' : 'No matching entries for this reseller, date range and request type.'}</p>
        ) : shown.map((r) => {
          const isOpen = open === r.key;
          const sortedLogs = [...r.logs].sort((a, b) => (logDay(b)?.getTime() || 0) - (logDay(a)?.getTime() || 0));
          return (
            <div key={r.key} className="border-b border-slate-100 last:border-b-0">
              <button type="button" onClick={() => setOpen(isOpen ? null : r.key)} aria-expanded={isOpen}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-brand-50 transition-colors">
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900 text-sm truncate">{r.name}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {r.first ? `${showDate(r.first)}${r.last && r.last.getTime() !== r.first.getTime() ? ` to ${showDate(r.last)}` : ''}` : 'No readable dates'}
                    {r.pending > 0 ? ` · ${r.pending} pending` : ''}
                    {(() => { const w = r.logs.filter((l) => expectsForm(l) && !hasForm(l)).length; return w > 0 ? ` · ${w} forms awaiting` : ''; })()}
                  </span>
                  <span className="mt-1.5 block h-1.5 rounded-full bg-brand-50 overflow-hidden"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.count / max) * 100}%` }} /></span>
                </span>
                <span className="font-display text-lg font-bold text-brand-700 shrink-0 w-12 text-right">{r.count}</span>
              </button>

              {isOpen && (
                <div className="bg-[#f7fcf8] px-4 pb-3 overflow-x-auto">
                  <table className="w-full text-xs min-w-[520px]">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3 font-semibold">#</th><th className="pr-3 font-semibold">Date</th><th className="pr-3 font-semibold">Customer</th><th className="pr-3 font-semibold">NMS ID</th><th className="font-semibold">Status</th>
                    </tr></thead>
                    <tbody>
                      {sortedLogs.map((l) => (
                        <tr key={l.id} onClick={() => onOpenLog(l.id)} className="border-t border-brand-100 cursor-pointer hover:bg-brand-50">
                          <td className="py-1.5 pr-3 font-mono font-semibold text-brand-700">#{l.logNo}</td>
                          <td className="pr-3 text-slate-600 whitespace-nowrap">{l.date}</td>
                          <td className="pr-3 text-slate-900 font-medium">{l.customerName || '—'}</td>
                          <td className="pr-3 font-mono text-slate-600">{l.nmsId || '—'}</td>
                          <td className="text-slate-600">{l.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
