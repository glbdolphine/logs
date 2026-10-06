import React, { useEffect } from 'react';
import {
  LayoutDashboard, Layers, Users, Contact, FileText, Database, Shield, History, HardDrive, KeyRound, X,
} from 'lucide-react';
import { BRAND_SLOGAN } from '../brand';

export type AppView = 'home' | 'sheet' | 'form' | 'maker' | 'resellers' | 'directory';

interface SidebarProps {
  /** Whether the sidebar is showing right now (already resolved for the current screen size). */
  visible: boolean;
  /** Large screens keep the sidebar in the page; smaller screens use it as a slide-over drawer. */
  isDesktop: boolean;
  onClose: () => void;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  logsCount: number;
  userName?: string;
  userRole?: string;
  onOpenBackup: () => void;
  onOpenActivity?: () => void;
  onChangePassword?: () => void;
  /** Admin-only. */
  onOpenSuggestions?: () => void;
  onOpenAdmin?: () => void;
}

type Item = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  badge?: number;
};

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

export const Sidebar: React.FC<SidebarProps> = ({
  visible, isDesktop, onClose, currentView, onNavigate, logsCount, userName, userRole,
  onOpenBackup, onOpenActivity, onChangePassword, onOpenSuggestions, onOpenAdmin,
}) => {
  const drawerOpen = !isDesktop && visible;

  // Drawer niceties: Esc closes it, and the page behind it doesn't scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, onClose]);

  // After picking something on a small screen, get the drawer out of the way.
  const act = (fn: () => void) => () => {
    fn();
    if (!isDesktop) onClose();
  };

  const workspace: Item[] = [
    { key: 'home', label: 'Home', icon: LayoutDashboard, onClick: () => onNavigate('home'), active: currentView === 'home' },
    { key: 'logs', label: 'Logs', icon: Layers, onClick: () => onNavigate('sheet'), active: currentView === 'sheet', badge: logsCount },
    { key: 'resellers', label: 'Resellers', icon: Users, onClick: () => onNavigate('resellers'), active: currentView === 'resellers' },
    { key: 'directory', label: 'Reseller List', icon: Contact, onClick: () => onNavigate('directory'), active: currentView === 'directory' },
    { key: 'maker', label: 'Form Maker', icon: FileText, onClick: () => onNavigate('maker'), active: currentView === 'maker' },
  ];

  const manage: Item[] = [
    ...(onOpenActivity ? [{ key: 'activity', label: 'Activity', icon: History, onClick: onOpenActivity }] : []),
    { key: 'backup', label: 'Backup & Data', icon: HardDrive, onClick: onOpenBackup },
    ...(onOpenSuggestions ? [{ key: 'saved', label: 'Saved Values', icon: Database, onClick: onOpenSuggestions }] : []),
    ...(onOpenAdmin ? [{ key: 'admin', label: 'Admin', icon: Shield, onClick: onOpenAdmin }] : []),
  ];

  const row = (it: Item) => (
    <button
      key={it.key}
      type="button"
      onClick={act(it.onClick)}
      aria-current={it.active ? 'page' : undefined}
      className={`w-full h-10 px-3 flex items-center gap-3 rounded-xl text-[13px] font-semibold text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        it.active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'
      }`}
    >
      <it.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{it.label}</span>
      {it.badge !== undefined && (
        <span className={`text-[11px] font-mono tabular-nums ${it.active ? 'text-brand-100' : 'text-slate-400'}`}>{it.badge}</span>
      )}
    </button>
  );

  const heading = (text: string) => (
    <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{text}</p>
  );

  return (
    <>
      {/* Dim the page behind the drawer on small screens */}
      {drawerOpen && (
        <div
          className="no-print fixed inset-0 z-[45] bg-slate-900/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Main menu"
        inert={!visible}
        className={`no-print bg-white flex flex-col shrink-0 overflow-hidden transition-[transform,width] duration-200 ease-out
          fixed top-0 left-0 h-dvh w-72 max-w-[85vw] z-50
          ${visible ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:z-20 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:self-start
          ${visible ? 'lg:w-60 lg:border-r lg:border-brand-100' : 'lg:w-0'}`}
      >
        {/* Fixed-width inner box so the content doesn't squash while the rail animates */}
        <div className="flex flex-col h-full w-72 max-w-[85vw] lg:w-60 lg:max-w-none">
          {/* Drawer header (small screens only) */}
          <div className="lg:hidden h-14 px-4 flex items-center justify-between border-b border-brand-100 shrink-0">
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold tracking-tight text-brand-700">
                Pace <span className="text-brand-500">IT</span>
              </span>
              <span className="font-display text-[8px] font-medium uppercase tracking-[0.22em] text-slate-500 mt-1">{BRAND_SLOGAN}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Close menu"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            <div className="space-y-1">
              {heading('Workspace')}
              {workspace.map(row)}
            </div>
            <div className="space-y-1">
              {heading('Manage')}
              {manage.map(row)}
            </div>
          </nav>

          {(userName || onChangePassword) && (
            <div className="shrink-0 border-t border-brand-100 p-3 space-y-1">
              {userName && (
                <div className="flex items-center gap-3 px-3 py-2" title={`Signed in as ${userName}`}>
                  <span className="w-8 h-8 shrink-0 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-bold">
                    {initialsOf(userName)}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[13px] font-semibold text-slate-800 truncate">{userName}</span>
                    {userRole && <span className="block text-[11px] text-slate-500 capitalize">{userRole}</span>}
                  </span>
                </div>
              )}
              {onChangePassword && row({ key: 'password', label: 'Password', icon: KeyRound, onClick: onChangePassword })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
