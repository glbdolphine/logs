import React, { useEffect, useMemo, useState } from 'react';
import { LogEntry, FieldSuggestionsMap, ActivityEvent, AppUser, Reseller } from './types';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LogsToolbar, StatusFilter, ViewMode } from './components/LogsToolbar';
import { LogList, LogDetailModal } from './components/LogList';
import { DevelopedBy } from './components/DevelopedBy';
import { LogForm } from './components/LogForm';
import { FormMaker } from './components/FormMaker';
import { ResellerSupply } from './components/ResellerSupply';
import { ResellerDirectory } from './components/ResellerDirectory';
import { Dashboard, DashboardGo } from './components/Dashboard';
import { LogSheetView } from './components/LogSheetView';
import { SuggestionsModal } from './components/SuggestionsModal';
import { BackupModal } from './components/BackupModal';
import { ActivityModal } from './components/ActivityModal';
import { AdminPanel } from './components/AdminPanel';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import {
  loadLogs, saveLog, deleteLog, clearAllLogs, loadSuggestions, saveSuggestions,
  loadActivity, subscribeToCloud, restoreLogs, getAccessToken, importLocalBrowserData,
  loadResellers, createReseller, updateReseller, deleteReseller, notePasswordChanged,
} from './utils/cloud';
import { exportAppBackup } from './utils/storage';
import { FormFilter, ImportPlan, expectsForm, hasForm } from './utils/forms';
import { FollowFilter, followState } from './utils/followUps';
import { Plus } from 'lucide-react';

const DESKTOP_QUERY = '(min-width: 1024px)';

interface AppProps {
  onLock?: () => void;
  currentUser: AppUser;
  initialAdminPanelOpen?: boolean;
}

export default function App({ onLock, currentUser, initialAdminPanelOpen = false }: AppProps) {
  const user = currentUser;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [suggestions, setSuggestions] = useState<FieldSuggestionsMap>({} as FieldSuggestionsMap);
  const [selectedLogId, setSelectedLogId] = useState('');
  const [currentView, setCurrentView] = useState<'home' | 'sheet' | 'form' | 'maker' | 'resellers' | 'directory'>('home');
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [followFilter, setFollowFilter] = useState<FollowFilter>('all');
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(initialAdminPanelOpen && currentUser.role === 'admin');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formFilter, setFormFilter] = useState<FormFilter>('all');
  const [loading, setLoading] = useState(true);
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return localStorage.getItem('pace_it_view_mode') === 'list' ? 'list' : 'card'; } catch { return 'card'; }
  });
  const changeViewMode = (m: ViewMode) => {
    setViewMode(m);
    try { localStorage.setItem('pace_it_view_mode', m); } catch { /* ignore */ }
  };

  // Sidebar: a persistent, collapsible rail on large screens, a slide-over drawer on small ones.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [sidebarDesktopOpen, setSidebarDesktopOpen] = useState(() => {
    try { return localStorage.getItem('pace_it_sidebar') !== 'closed'; } catch { return true; }
  });
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const sidebarVisible = isDesktop ? sidebarDesktopOpen : sidebarMobileOpen;
  const toggleSidebar = () => {
    if (!isDesktop) { setSidebarMobileOpen((v) => !v); return; }
    const next = !sidebarDesktopOpen;
    setSidebarDesktopOpen(next);
    try { localStorage.setItem('pace_it_sidebar', next ? 'open' : 'closed'); } catch { /* ignore */ }
  };
  const closeSidebar = React.useCallback(() => setSidebarMobileOpen(false), []);

  const handlePrintAll = () => {
    setPrintingAll(true);
    const done = () => { setPrintingAll(false); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.setTimeout(() => window.print(), 150);
  };

  const refreshLogs = async () => {
    try {
      const data = await loadLogs();
      setLogs(data);
      setSelectedLogId(current => current && data.some(l => l.id === current) ? current : (data[0]?.id || ''));
    } catch (e) {
      console.error(e);
      showToast('Could not refresh shared logs');
    }
  };

  const refreshActivity = async () => {
    try { setActivity(await loadActivity()); } catch (e) { console.error(e); }
  };

  const refreshResellers = async () => {
    try { setResellers(await loadResellers()); } catch (e) { console.error(e); }
  };

  const refreshSuggestions = async () => {
    try { setSuggestions(await loadSuggestions()); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    let alive = true;
    Promise.all([loadLogs(), loadActivity(), loadSuggestions(), loadResellers()])
      .then(([loadedLogs, loadedActivity, loadedSuggestions, loadedResellers]) => {
        if (!alive) return;
        setLogs(loadedLogs);
        setResellers(loadedResellers);
        setActivity(loadedActivity);
        setSuggestions(loadedSuggestions);
        setSelectedLogId(loadedLogs[0]?.id || '');
      })
      .catch((e) => {
        console.error(e);
        if (alive) showToast(e?.message || 'Could not load shared data');
      })
      .finally(() => { if (alive) setLoading(false); });

    const unsubscribe = subscribeToCloud(refreshLogs, refreshActivity, refreshSuggestions, refreshResellers);
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    let armed = false;
    let timer: number | undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        armed = true;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { armed = false; }, 1200);
        return;
      }
      if (armed && e.key.toLowerCase() === 't') {
        armed = false;
        window.clearTimeout(timer);
        if (user.role === 'admin') setIsAdminPanelOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.clearTimeout(timer);
    };
  }, [user.role]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2600);
  };

  const nextLogNo = useMemo(() => {
    if (!logs.length) return 1;
    return Math.max(...logs.map(l => {
      const n = typeof l.logNo === 'number' ? l.logNo : parseInt(String(l.logNo), 10);
      return Number.isFinite(n) ? n : 0;
    })) + 1;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const s = (log.status || '').toLowerCase();
      if (statusFilter === 'pending' && !s.includes('pending') && !s.includes('waiting')) return false;
      if (statusFilter === 'in_progress' && !s.includes('progress')) return false;
      if (statusFilter === 'resolved' && !s.includes('resolved') && !s.includes('closed')) return false;
      if (followFilter !== 'all' && followState(log) !== followFilter) return false;
      if (formFilter !== 'all') {
        if (!expectsForm(log)) return false;
        if (formFilter === 'awaiting' && hasForm(log)) return false;
        if (formFilter === 'received' && !hasForm(log)) return false;
      }
      if (!query) return true;
      return [
        log.logNo, log.date, log.resellerName, log.callerPhone, log.requestType,
        log.customerName, log.nmsId, log.issueFound, log.missingWrongDetails,
        log.actionTaken, log.reasonForAction, log.status, log.remarks, log.mac,
        log.edcNo, log.routerSerial,
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }, [logs, searchTerm, statusFilter, formFilter, followFilter]);

  const followCounts = useMemo(() => ({
    today: logs.filter((l) => followState(l) === 'today').length,
    overdue: logs.filter((l) => followState(l) === 'overdue').length,
  }), [logs]);

  const goLogs = (t: DashboardGo) => {
    setSearchTerm('');
    setStatusFilter(t.status ?? 'all');
    setFormFilter(t.form ?? 'all');
    setFollowFilter(t.follow ?? 'all');
    setCurrentView('sheet');
  };

  const displayLogs = useMemo(() => {
    const num = (l: LogEntry) => {
      const n = typeof l.logNo === 'number' ? l.logNo : parseInt(String(l.logNo), 10);
      return Number.isFinite(n) ? n : 0;
    };
    return [...filteredLogs].sort((a,b) => num(a)-num(b));
  }, [filteredLogs]);

  const scrollToLog = (id: string) => {
    window.setTimeout(() => document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const handleSaveLog = async (entry: LogEntry, andCreateAnother = false) => {
    try {
      const existing = logs.find(l => l.id === entry.id) || null;
      const saved = await saveLog(entry, user, existing);
      await Promise.all([refreshLogs(), refreshActivity(), refreshSuggestions()]);
      setSelectedLogId(saved.id);
      scrollToLog(saved.id);
      setSearchTerm('');
      setStatusFilter('all');
      setFollowFilter('all');
      showToast(`Log #${saved.logNo} saved`);
      if (!andCreateAnother) {
        setEditingLog(null);
        setCurrentView('sheet');
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not save log');
    }
  };

  // Called by Form Maker after a form is downloaded. New logs get the same defaults as the log form;
  // re-downloads only refresh the auto-filled fields so anything typed later is kept.
  const handleAutoLog = async (fields: Partial<LogEntry>, existingId?: string): Promise<LogEntry> => {
    const existing = existingId ? logs.find(l => l.id === existingId) || null : null;
    const now = new Date().toISOString();
    const entry = (existing ? { ...existing, ...fields } : {
      id: crypto.randomUUID(), logNo: nextLogNo, resellerName: '', callerPhone: '',
      issueFound: '', missingWrongDetails: '', actionTaken: '', reasonForAction: '',
      resellerInformed: 'Yes - phone', followUpNeeded: 'Yes', status: 'Pending - waiting for reseller',
      supervisorInformed: 'I informed my superiors', remarks: '', createdAt: now, updatedAt: now,
      ...fields,
    }) as LogEntry;
    const saved = await saveLog(entry, user, existing);
    await Promise.all([refreshLogs(), refreshActivity(), refreshSuggestions()]);
    showToast(`Log #${saved.logNo} ${existing ? 'updated' : 'created'}`);
    return saved;
  };

  const handleToggleForm = async (log: LogEntry) => {
    try {
      const got = hasForm(log);
      await saveLog({ ...log, formReceivedAt: got ? '' : new Date().toISOString() }, user, log);
      await Promise.all([refreshLogs(), refreshActivity()]);
      showToast(got ? `Form for #${log.logNo} set back to awaiting` : `Form for #${log.logNo} marked received`);
    } catch (e: any) {
      showToast(e?.message || 'Could not update form status');
    }
  };

  const handleApplyFormImport = async (plan: ImportPlan) => {
    try {
      for (const { log, at } of plan.toMark) await saveLog({ ...log, formReceivedAt: at }, user, log);
      await Promise.all([refreshLogs(), refreshActivity()]);
      showToast(`${plan.toMark.length} forms marked received`);
    } catch (e: any) {
      await refreshLogs();
      showToast(e?.message || 'Import stopped part-way; check the list');
    }
  };

  const handleEdit = (log: LogEntry) => {
    setEditingLog(log);
    setCurrentView('form');
  };

  const handleDuplicate = (log: LogEntry) => {
    const now = new Date().toISOString();
    setEditingLog({
      ...log,
      id: crypto.randomUUID(),
      logNo: nextLogNo,
      date: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
      createdAt: now,
      updatedAt: now,
      createdBy: user.displayName,
      updatedBy: user.displayName,
      history: [],
      formReceivedAt: '',
    });
    setCurrentView('form');
    showToast(`Duplicated to Log #${nextLogNo}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLog(id, user);
      await Promise.all([refreshLogs(), refreshActivity()]);
      showToast('Log moved to the admin bin');
    } catch (e: any) {
      showToast(e?.message || 'Could not delete log');
    }
  };

  const handleClearAllLogs = async () => {
    try {
      await clearAllLogs(user);
      await Promise.all([refreshLogs(), refreshActivity()]);
      setSelectedLogId('');
      setCurrentView('sheet');
      showToast('All logs moved to the admin bin');
    } catch (e: any) {
      showToast(e?.message || 'Could not clear logs');
    }
  };

  const handleRestoreBackup = async (importedLogs: LogEntry[], importedSuggestions: FieldSuggestionsMap, merge: boolean) => {
    try {
      const total = await restoreLogs(importedLogs, merge, user);
      await saveSuggestions(importedSuggestions);
      await Promise.all([refreshLogs(), refreshActivity(), refreshSuggestions()]);
      showToast(`Restored ${total} shared logs`);
    } catch (e: any) {
      showToast(e?.message || 'Could not restore backup');
    }
  };

  const handleUpdateSuggestions = async (updated: FieldSuggestionsMap) => {
    try {
      await saveSuggestions(updated);
      setSuggestions(updated);
      showToast('Saved values updated');
    } catch (e: any) {
      showToast(e?.message || 'Could not update saved values');
    }
  };

  const handleImportLocal = async () => {
    try {
      const total = await importLocalBrowserData(user);
      await refreshLogs();
      await refreshActivity();
      showToast(total ? `Imported ${total} local logs into shared storage` : 'No old local logs found');
    } catch (e: any) {
      showToast(e?.message || 'Could not import local data');
    }
  };

  const handleCreateReseller = async (input: { name: string; area: string; phone: string }) => {
    await createReseller(input, user);
    await Promise.all([refreshResellers(), refreshActivity()]);
    showToast('Reseller added');
  };
  const handleUpdateReseller = async (id: string, input: { name: string; area: string; phone: string; active: boolean }) => {
    await updateReseller(id, input);
    await Promise.all([refreshResellers(), refreshLogs()]);
    showToast('Reseller updated');
  };
  const handleDeleteReseller = async (id: string) => {
    try {
      await deleteReseller(id);
      await Promise.all([refreshResellers(), refreshActivity()]);
      showToast('Reseller moved to the admin bin');
    } catch (e: any) {
      showToast(e?.message || 'Could not delete reseller');
    }
  };

  const handleChangePassword = async (password: string) => {
    const { supabase } = await import('./utils/supabase');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await notePasswordChanged();
    showToast('Password changed');
    setIsPasswordModalOpen(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#eef8f1] flex items-center justify-center text-sm text-slate-500">Loading shared Pace IT data…</div>;
  }

  return (
    <div className="min-h-screen bg-[#eef8f1] flex flex-col font-sans">
      <Navbar
        onGoHome={() => setCurrentView('home')}
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarVisible}
        onNewLog={() => { setEditingLog(null); setCurrentView('form'); }}
        onLock={onLock}
      />

      <div className="flex flex-1 min-w-0">
        <Sidebar
          visible={sidebarVisible}
          isDesktop={isDesktop}
          onClose={closeSidebar}
          currentView={currentView}
          onNavigate={setCurrentView}
          logsCount={logs.length}
          userName={user.displayName}
          userRole={user.role}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          onOpenActivity={() => setIsActivityModalOpen(true)}
          onChangePassword={() => setIsPasswordModalOpen(true)}
          onOpenSuggestions={user.role === 'admin' ? () => setIsSuggestionsModalOpen(true) : undefined}
          onOpenAdmin={user.role === 'admin' ? () => setIsAdminPanelOpen(true) : undefined}
        />

        <div className="flex-1 min-w-0 flex flex-col">
      {currentView === 'sheet' && logs.length > 0 && (
        <div className="no-print sticky top-14 z-30 shadow-sm">
          <LogsToolbar totalCount={logs.length} filteredLogs={displayLogs} searchTerm={searchTerm}
            onSearchChange={setSearchTerm} statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter} onJumpToLog={setOpenLogId}
            viewMode={viewMode} onViewModeChange={changeViewMode} onPrintAll={handlePrintAll}
            allLogs={logs} formFilter={formFilter} onFormFilterChange={setFormFilter}
            onPickFormReseller={(name) => { setSearchTerm(name); setFormFilter('awaiting'); }}
            onApplyFormImport={handleApplyFormImport}
            resellers={resellers} followFilter={followFilter} onFollowFilterChange={setFollowFilter} followCounts={followCounts} />
        </div>
      )}

      <main className="no-print flex-1 w-full p-3 sm:p-4 max-w-[1400px] mx-auto">
        {toastMessage && <div className="fixed bottom-4 right-4 z-50 bg-brand-800 text-white text-xs px-3 py-1.5 rounded shadow-lg">{toastMessage}</div>}

        {currentView === 'home' && (
          <Dashboard logs={logs} activity={activity} userName={user.displayName} onOpenLog={setOpenLogId} onGo={goLogs} />
        )}

        {currentView === 'directory' && (
          <ResellerDirectory resellers={resellers} logs={logs}
            onCreate={handleCreateReseller} onUpdate={handleUpdateReseller} onDelete={handleDeleteReseller} />
        )}

        {currentView === 'resellers' && (
          <ResellerSupply logs={logs} onOpenLog={setOpenLogId} />
        )}

        {currentView === 'maker' && (
          <FormMaker
            logs={logs}
            onLog={handleAutoLog}
            onOpenLog={(id) => { const l = logs.find(x => x.id === id); if (l) handleEdit(l); }}
          />
        )}

        {currentView === 'form' && (
          <LogForm
            initialData={editingLog}
            nextLogNo={nextLogNo}
            suggestions={suggestions}
            logs={logs}
            resellers={resellers}
            onSave={handleSaveLog}
            onCancel={() => { setEditingLog(null); setCurrentView('sheet'); }}
          />
        )}

        {currentView === 'sheet' && logs.length === 0 && (
          <div className="bg-white rounded-2xl border border-brand-100 text-center py-16 px-4">
            <p className="text-sm text-slate-500 mb-4">No shared logs yet.</p>
            <button onClick={() => { setEditingLog(null); setCurrentView('form'); }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-brand-800 hover:bg-brand-900 rounded">
              <Plus className="w-3.5 h-3.5" /> Create the first log
            </button>
          </div>
        )}

        {currentView === 'sheet' && logs.length > 0 && (
          <div>
            {displayLogs.length > 0 ? (
              <LogList logs={displayLogs} mode={viewMode} resellers={resellers} onOpen={(l) => setOpenLogId(l.id)} onToggleForm={handleToggleForm} />
            ) : (
              <div className="bg-white rounded-2xl border border-brand-100 text-center py-16 px-4"><p className="text-sm text-slate-500">No logs match your search or filter.</p></div>
            )}
          </div>
        )}
      </main>

      <DevelopedBy />
        </div>
      </div>

      <LogDetailModal
        log={logs.find((l) => l.id === openLogId) || null}
        onClose={() => setOpenLogId(null)}
        onEdit={(l) => { setOpenLogId(null); handleEdit(l); }}
        onDuplicate={(l) => { setOpenLogId(null); handleDuplicate(l); }}
        onDelete={(id) => { setOpenLogId(null); handleDelete(id); }}
        onToggleForm={handleToggleForm}
      />

      {printingAll && (
        <div className="hidden print:block">
          {displayLogs.map((l) => <LogSheetView key={l.id} log={l} />)}
        </div>
      )}

      {user.role === 'admin' && <SuggestionsModal isOpen={isSuggestionsModalOpen} onClose={() => setIsSuggestionsModalOpen(false)} suggestions={suggestions} onUpdateSuggestions={handleUpdateSuggestions} />}
      <ActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} events={activity} />
      <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} logs={logs} suggestions={suggestions} onRestore={handleRestoreBackup} onClearAllLogs={handleClearAllLogs} />
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} currentUser={user} onToast={showToast} onImportLocal={handleImportLocal}
        onBinChanged={() => { refreshLogs(); refreshResellers(); refreshActivity(); }} />
      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} onSave={handleChangePassword} />
    </div>
  );
}
