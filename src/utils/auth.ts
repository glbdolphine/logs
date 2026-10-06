import { supabase, isSupabaseConfigured } from './supabase';
import { AppUser } from '../types';

const LAST_USER_KEY = 'pace_it_last_user_v2';

export function cleanUserName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 40);
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 64);
}

export function getLastUser(): string {
  try {
    return localStorage.getItem(LAST_USER_KEY) || '';
  } catch {
    return '';
  }
}

export function setLastUser(name: string): void {
  try { localStorage.setItem(LAST_USER_KEY, name); } catch { /* ignore */ }
}

// allowAdmin is true ONLY for the hidden administrator gate (Esc, then T).
// The normal login page never accepts the administrator account.
export async function login(username: string, password: string, allowAdmin = false): Promise<AppUser> {
  const normalized = normalizeUsername(username);
  if (!normalized || !password) throw new Error('Username and password are required.');

  if (!allowAdmin && normalized === 'admin') {
    await new Promise((r) => setTimeout(r, 250));
    throw new Error('Invalid username or password.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart "npm run dev".');
  }

  const { data: email, error: lookupError } = await supabase.rpc('get_login_email', {
    p_username: normalized,
  });
  if (lookupError) {
    console.error('Pace-IT login: get_login_email failed', lookupError);
    throw new Error(`Cannot reach the login service (${lookupError.message}). Check your .env.local keys and run supabase_admin_repair.sql.`);
  }
  if (!email) {
    await new Promise((r) => setTimeout(r, 250));
    throw new Error(
      normalized === 'admin'
        ? 'No administrator profile found. Run supabase_admin_repair.sql in the Supabase SQL Editor.'
        : 'Invalid username or password.'
    );
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: String(email),
    password,
  });
  if (error) {
    console.error('Pace-IT login: signInWithPassword failed', error);
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('Invalid username or password.');
    }
    throw new Error(`Sign-in failed: ${error.message}. Run supabase_admin_repair.sql in the Supabase SQL Editor.`);
  }

  const user = await getCurrentUser();
  if (!user) throw new Error('Your account was authenticated but your profile could not be loaded.');
  if (!allowAdmin && user.role === 'admin') {
    await supabase.auth.signOut();
    throw new Error('Invalid username or password.');
  }
  if (!allowAdmin) setLastUser(user.username);
  return user;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, role, disabled')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;
  if (profile.disabled) {
    await supabase.auth.signOut();
    return null;
  }

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    role: profile.role,
  };
}

export async function changePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  try { await supabase.rpc('note_my_password_changed'); } catch { /* not critical */ }
}

export async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Please log in again.');
  return session.access_token;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthChange(callback: (user: AppUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }
    // Avoid doing extra work synchronously inside the auth callback.
    setTimeout(async () => callback(await getCurrentUser()), 0);
  });
}
