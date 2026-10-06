import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, MapPin, X } from 'lucide-react';
import { LogEntry, Reseller } from '../types';
import { matchReseller } from '../utils/resellers';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  resellers: Reseller[];
  logs: LogEntry[];
  onCreate: (input: { name: string; area: string; phone: string }) => Promise<void>;
  onUpdate: (id: string, input: { name: string; area: string; phone: string; active: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const blank = { name: '', area: '', phone: '', active: true };
const field = 'w-full h-9 px-3 text-xs border border-slate-300 rounded focus:outline-none focus:border-brand-600 bg-white';

export const ResellerDirectory: React.FC<Props> = ({ resellers, logs, onCreate, onUpdate, onDelete }) => {
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<Reseller | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const r = matchReseller(l, resellers);
      if (r) m.set(r.id, (m.get(r.id) || 0) + 1);
    }
    return m;
  }, [logs, resellers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resellers.filter((r) =>
      (showInactive || r.active) && (!q || [r.name, r.area, r.phone].join(' ').toLowerCase().includes(q)));
  }, [resellers, query, showInactive]);

  const open = (r?: Reseller) => {
    setError('');
    setForm(r ? { name: r.name, area: r.area, phone: r.phone, active: r.active } : blank);
    setEditing(r ? r.id : 'new');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    setBusy(true); setError('');
    try {
      if (editing === 'new') await onCreate(form);
      else if (editing) await onUpdate(editing, form);
      setEditing(null);
    } catch (err: any) { setError(err?.message || 'Could not save.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="w-full space-y-4">
      <div className="pb-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">Reseller List</h1>
          <p className="text-xs text-slate-500 mt-0.5">One list for everyone. Logs pick a reseller from here, and the phone number is used for WhatsApp reminders.</p>
        </div>
        <button onClick={() => open()} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-full shadow-sm">
          <Plus className="w-3.5 h-3.5" />Add reseller
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, area, phone…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-[#e8eefb] rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-600" />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Show inactive
        </label>
        <span className="text-[11px] text-slate-500 font-mono">{rows.length} of {resellers.length}</span>
      </div>

      {resellers.length === 0 && (
        <div className="bg-white rounded-2xl border border-brand-100 text-center py-12 px-4 text-sm text-slate-500">No resellers yet. Add the first one.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.id} className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col gap-2 ${r.active ? 'border-brand-100' : 'border-slate-200 opacity-70'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-slate-900 leading-snug break-words">{r.name}</div>
              <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${r.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {r.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" />{r.area || <span className="text-slate-400">No area</span>}</div>
              <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{r.phone || <span className="text-rose-500">No phone (WhatsApp reminders won't work)</span>}</div>
            </div>
            <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">{counts.get(r.id) || 0} logs</span>
              <div className="flex gap-1">
                <button onClick={() => open(r)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 rounded hover:bg-slate-50"><Pencil className="w-3 h-3" />Edit</button>
                <button onClick={() => setToDelete(r)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-rose-700 border border-rose-200 rounded hover:bg-rose-50"><Trash2 className="w-3 h-3" />Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <form onSubmit={save} className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{editing === 'new' ? 'Add reseller' : 'Edit reseller'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{error}</div>}
            <label className="block text-xs font-medium text-slate-600">Name
              <input className={`${field} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shabul- Balaganj" autoFocus required />
            </label>
            <label className="block text-xs font-medium text-slate-600">Area
              <input className={`${field} mt-1`} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Balaganj" />
            </label>
            <label className="block text-xs font-medium text-slate-600">Phone (WhatsApp)
              <input className={`${field} mt-1`} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 01712-345678" />
            </label>
            {editing !== 'new' && (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active (inactive resellers are hidden from the log form)
              </label>
            )}
            {editing !== 'new' && <p className="text-[11px] text-slate-400">Renaming also updates the name shown on this reseller's existing logs.</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs rounded-full border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button disabled={busy} className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand-800 hover:bg-brand-900 rounded-full disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={`Delete ${toDelete?.name || 'reseller'}?`}
        message="It moves to the admin bin. Existing logs keep the name. Only the admin can restore it or delete it for good."
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { const r = toDelete; setToDelete(null); if (r) await onDelete(r.id); }}
      />
    </div>
  );
};
