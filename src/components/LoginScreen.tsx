import { DevelopedBy } from './DevelopedBy';
import React, { useState } from 'react';
import { Eye, EyeOff, Shield, X } from 'lucide-react';
import { login, getLastUser } from '../utils/auth';
import { AppUser } from '../types';
import logo from '../logo/logo-mark.jpg';
import { NetworkBackdrop, LoginIllustration } from './LoginArt';

interface LoginScreenProps {
  onUnlock: (user: AppUser) => void;
  onAdminUnlock: (user: AppUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, onAdminUnlock }) => {
  const [username, setUsername] = useState(getLastUser());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminGateOpen, setAdminGateOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);


  React.useEffect(() => {
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
        setAdminError('');
        setAdminPassword('');
        setAdminGateOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.clearTimeout(timer);
    };
  }, []);

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminBusy) return;
    setAdminBusy(true);
    setAdminError('');
    try {
      const admin = await login('admin', adminPassword, true);
      if (admin.role !== 'admin') throw new Error('Administrator account is not configured correctly.');
      setAdminGateOpen(false);
      onAdminUnlock(admin);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Invalid administrator password.');
      setAdminPassword('');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = username.trim();
    if (name.length < 2) {
      setError('Enter your username.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const user = await login(name, password);
      onUnlock(user);
    } catch (err) {
      await new Promise((r) => setTimeout(r, 350));
      setError(err instanceof Error ? err.message : 'Could not log in.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#eef8f1] overflow-hidden">
      <NetworkBackdrop />

      {/*
        Two equal columns, each centred in its own half, with identical 26rem content boxes:
        the illustration and the form mirror each other around the middle of the page.
        The footer is pinned to the bottom, so the vertical padding is equal top and bottom
        (4rem each, enough to clear the footer) and the content sits dead centre in the viewport.
      */}
      <main className="relative min-h-screen w-full max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-16 items-center">
        {/* Illustration (hidden on small screens) */}
        <div className="hidden lg:flex justify-center">
          <div className="w-full max-w-[26rem]">
            <LoginIllustration />
          </div>
        </div>

        {/* Form */}
        <div className="flex justify-center">
          <form onSubmit={handleSubmit} className="w-full max-w-[26rem]">
            {/* Logo: pre-cropped to its artwork with equal margins, so it centres exactly */}
            <img
              src={logo}
              alt="Pace IT - Solution For Technology"
              width={580}
              height={775}
              draggable={false}
              className="block mx-auto mb-6 w-[208px] h-auto select-none mix-blend-multiply"
            />

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm text-slate-600 mb-1.5">
                  Username<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  id="username"
                  type="text"
                  autoFocus={!username}
                  autoComplete="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full h-11 px-3 text-sm text-slate-900 bg-[#e8eefb] border border-transparent rounded focus:outline-none focus:border-[#2f8f3a] focus:bg-white transition-colors placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm text-slate-600 mb-1.5">
                  Password<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoFocus={Boolean(username)}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full h-11 pl-3 pr-10 text-sm text-slate-900 bg-[#e8eefb] border border-transparent rounded focus:outline-none focus:border-[#2f8f3a] focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 text-slate-500 hover:text-slate-800"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Always takes up the same room, so showing an error never shifts the layout */}
            <p className="h-4 mt-1.5 text-xs leading-4 text-red-600" role="alert">{error}</p>

            <button
              type="submit"
              disabled={busy || !password || !username.trim()}
              className="mt-2 block w-full h-11 text-sm font-medium text-white bg-[#2f8f3a] hover:bg-[#287a32] rounded transition-colors disabled:opacity-60"
            >
              {busy ? 'Checking...' : 'Login'}
            </button>
          </form>
        </div>
      </main>

      {adminGateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <form onSubmit={handleAdminUnlock} className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold"><Shield className="w-4 h-4 text-[#2f8f3a]" /> Administrator access</div>
                <p className="text-xs text-slate-500 mt-1">Enter the administrator password to open the hidden admin panel.</p>
              </div>
              <button type="button" onClick={() => setAdminGateOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <input
              autoFocus
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Administrator password"
              autoComplete="current-password"
              className="w-full h-11 px-3 text-sm border border-slate-200 rounded focus:outline-none focus:border-[#2f8f3a]"
            />
            {adminError && <p className="text-xs text-red-600 mt-2">{adminError}</p>}
            <button type="submit" disabled={adminBusy || !adminPassword} className="mt-4 w-full h-11 bg-[#2f8f3a] hover:bg-[#287a32] text-white rounded text-sm font-medium disabled:opacity-60">
              {adminBusy ? 'Checking...' : 'Open Admin Panel'}
            </button>
            <p className="text-[11px] text-slate-400 mt-3 text-center">Shortcut: press Esc, release it, then press T.</p>
          </form>
        </div>
      )}

      <DevelopedBy className="absolute inset-x-0 bottom-0" />
    </div>
  );
};
