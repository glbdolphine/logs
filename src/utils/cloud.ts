import { supabase } from './supabase';
import { ActivityEvent, AppUser, FieldSuggestionsMap, LogEntry, LogFieldKey, Reseller } from '../types';
import { diffLogs } from './activity';
import { INITIAL_SUGGESTIONS } from './storage';

const LOG_FIELDS: LogFieldKey[] = [
  'resellerName','callerPhone','requestType','customerName','nmsId','issueFound',
  'missingWrongDetails','actionTaken','reasonForAction','resellerInformed',
  'followUpNeeded','status','supervisorInformed','remarks','mac',
];

function normalizeLog(row: any): LogEntry {
  const data = (row.data || {}) as Partial<LogEntry>;
  return {
    ...(data as LogEntry),
    id: row.id,
    logNo: row.log_no ?? data.logNo ?? '',
    createdAt: row.created_at || data.createdAt || '',
    updatedAt: row.updated_at || data.updatedAt || row.created_at || '',
    createdBy: row.created_by_name || data.createdBy,
    updatedBy: row.updated_by_name || data.updatedBy,
    history: Array.isArray(data.history) ? data.history : [],
    ...(row.deleted_at ? { deletedAt: row.deleted_at, deletedBy: row.deleted_by_name || '' } : {}),
  };
}

export async function loadLogs(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .is('deleted_at', null)
    .order('log_no', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeLog);
}

export async function saveLog(entry: LogEntry, user: AppUser, existing?: LogEntry | null): Promise<LogEntry> {
  const now = new Date().toISOString();
  let saved: LogEntry;

  if (existing) {
    const changes = diffLogs(existing, entry);
    const history = [...(existing.history || [])];
    const stamped: LogEntry = {
      ...entry,
      id: existing.id,
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      updatedAt: changes.length ? now : existing.updatedAt,
      updatedBy: changes.length ? user.displayName : existing.updatedBy,
      history,
    };

    if (changes.length) {
      stamped.history.push({ at: now, by: user.displayName, action: 'edited', changes });
    }

    const { data, error } = await supabase
      .from('logs')
      .update({
        log_no: stamped.logNo,
        data: stamped,
        updated_at: stamped.updatedAt,
        updated_by: user.id,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    saved = normalizeLog(data);
  } else {
    const id = ensureUuid(entry.id);
    const created: LogEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: user.displayName,
      updatedBy: user.displayName,
      history: [{ at: now, by: user.displayName, action: 'created' }],
    };
    const { data, error } = await supabase
      .from('logs')
      .insert({
        id,
        log_no: created.logNo,
        data: created,
        created_at: now,
        updated_at: now,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;
    saved = normalizeLog(data);
  }

  if (!existing || diffLogs(existing, saved).length > 0) {
    await addCloudActivity({
      by: user.displayName,
      action: existing ? 'edited' : 'created',
      logNo: saved.logNo,
      customer: saved.customerName,
      detail: existing ? diffLogs(existing, saved).map(c => c.field).join(', ') : undefined,
    });
  }

  await harvestSuggestions(saved);
  return saved;
}

/** Moves the log to the admin bin. Everyone can do this; only the admin can restore or purge it. */
export async function deleteLog(id: string, _user?: AppUser): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_log', { p_id: id });
  if (error) throw new Error(error.message);
}

/** Moves every live log to the admin bin. */
export async function clearAllLogs(_user?: AppUser): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_all_logs');
  if (error) throw new Error(error.message);
}

export async function loadActivity(): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity')
    .select('*')
    .order('at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    at: r.at,
    by: r.by_name || r.by,
    action: r.action,
    logNo: r.log_no,
    customer: r.customer,
    detail: r.detail,
  }));
}

export async function addCloudActivity(event: Omit<ActivityEvent, 'id' | 'at'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('activity').insert({
    by: user.id,
    by_name: event.by,
    action: event.action,
    log_no: event.logNo ?? null,
    customer: event.customer ?? null,
    detail: event.detail ?? null,
  });
  if (error) throw error;
}

export async function loadSuggestions(): Promise<FieldSuggestionsMap> {
  const { data, error } = await supabase.from('suggestions').select('field, values');
  if (error) throw error;
  const merged: FieldSuggestionsMap = { ...INITIAL_SUGGESTIONS };
  for (const row of data || []) {
    if (LOG_FIELDS.includes(row.field as LogFieldKey) && Array.isArray(row.values)) {
      // A saved row is the source of truth, so deleted values stay deleted.
      // Built-in defaults are only used for fields that have no saved row yet.
      merged[row.field as LogFieldKey] = Array.from(new Set(row.values as string[]));
    }
  }
  return merged;
}

export async function saveSuggestions(suggestions: FieldSuggestionsMap): Promise<void> {
  const rows = LOG_FIELDS.map(field => ({ field, values: suggestions[field] || [] }));
  const { error } = await supabase.from('suggestions').upsert(rows, { onConflict: 'field' });
  if (error) throw error;
}

export async function harvestSuggestions(entry: Partial<LogEntry>): Promise<FieldSuggestionsMap> {
  const current = await loadSuggestions();
  for (const field of LOG_FIELDS) {
    const value = String(entry[field] || '').trim();
    if (!value) continue;
    const existing = current[field] || [];
    current[field] = [value, ...existing.filter(item => item.toLowerCase() !== value.toLowerCase())];
  }
  await saveSuggestions(current);
  return current;
}

export function subscribeToCloud(onLogs: () => void, onActivity: () => void, onSuggestions: () => void, onResellers?: () => void) {
  const channel = supabase.channel('pace-it-shared')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, onLogs)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, onActivity)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestions' }, onSuggestions)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'resellers' }, () => onResellers?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function restoreLogs(imported: LogEntry[], merge: boolean, user: AppUser): Promise<number> {
  if (!merge) {
    // Existing logs are not destroyed: they go to the admin bin.
    const { error } = await supabase.rpc('soft_delete_all_logs');
    if (error) throw new Error(error.message);
  }
  const rows = imported.map((orig) => {
    const l = { ...orig, id: ensureUuid(orig.id) };
    return {
    id: l.id,
    log_no: l.logNo,
    data: l,
    created_at: l.createdAt || new Date().toISOString(),
    updated_at: l.updatedAt || new Date().toISOString(),
    created_by: user.id,
    updated_by: user.id,
    };
  });
  if (rows.length) {
    const { error } = await supabase.from('logs').upsert(rows);
    if (error) throw error;
  }
  await addCloudActivity({ by: user.displayName, action: 'restored', detail: `${imported.length} logs imported (${merge ? 'merged' : 'replaced'})` });
  return (await loadLogs()).length;
}

export async function importLocalBrowserData(user: AppUser): Promise<number> {
  const raw = localStorage.getItem('pace_it_logs_v1');
  if (!raw) return 0;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.length) return 0;
  return restoreLogs(parsed, true, user);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The logs table uses uuid ids; older/local ids like "log-1790..." get a fresh uuid.
const ensureUuid = (id?: string) => (id && UUID_RE.test(id) ? id : crypto.randomUUID());

export async function listUsers(): Promise<any[]> {
  const { data, error } = await supabase.from('profiles')
    .select('id, username, display_name, role, created_at, disabled')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, displayName: r.display_name || r.username }));
}

export async function createUserAccount(_accessToken: string, username: string, password: string, displayName: string) {
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_username: username,
    p_password: password,
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function disableUserAccount(_accessToken: string, userId: string, disabled: boolean) {
  const { data, error } = await supabase.rpc('admin_set_user_disabled', {
    p_user_id: userId,
    p_disabled: disabled,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Please log in again.');
  return session.access_token;
}


// ---------------------------------------------------------------------------
// Resellers
// ---------------------------------------------------------------------------
const toReseller = (r: any): Reseller => ({
  id: r.id,
  name: r.name || '',
  area: r.area || '',
  phone: r.phone || '',
  active: r.active !== false,
  createdAt: r.created_at || '',
  deletedAt: r.deleted_at || undefined,
  deletedBy: r.deleted_by_name || undefined,
});

export async function loadResellers(): Promise<Reseller[]> {
  const { data, error } = await supabase.from('resellers').select('*').is('deleted_at', null).order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(toReseller);
}

export async function createReseller(input: { name: string; area: string; phone: string }, user: AppUser): Promise<Reseller> {
  const { data, error } = await supabase.from('resellers').insert({
    name: input.name.trim(),
    area: input.area.trim() || null,
    phone: input.phone.trim() || null,
    created_by_name: user.displayName,
  }).select('*').single();
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'A reseller with that name already exists.' : error.message);
  return toReseller(data);
}

export async function updateReseller(id: string, input: { name: string; area: string; phone: string; active: boolean }): Promise<void> {
  const { error } = await supabase.rpc('update_reseller', {
    p_id: id, p_name: input.name, p_area: input.area, p_phone: input.phone, p_active: input.active,
  });
  if (error) throw new Error(error.message);
}

export async function deleteReseller(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_reseller', { p_id: id });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Admin bin (RLS lets only the admin read deleted rows)
// ---------------------------------------------------------------------------
export async function loadBin(): Promise<{ logs: LogEntry[]; resellers: Reseller[] }> {
  const [l, r] = await Promise.all([
    supabase.from('logs').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('resellers').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
  ]);
  if (l.error) throw l.error;
  if (r.error) throw r.error;
  return { logs: (l.data || []).map(normalizeLog), resellers: (r.data || []).map(toReseller) };
}

const rpc = async (fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};
export const restoreBinLog = (id: string) => rpc('admin_restore_log', { p_id: id });
export const restoreBinReseller = (id: string) => rpc('admin_restore_reseller', { p_id: id });
export const purgeBinLog = (id: string) => rpc('admin_purge_log', { p_id: id });
export const purgeBinReseller = (id: string) => rpc('admin_purge_reseller', { p_id: id });
export const emptyBin = async (): Promise<number> => Number(await rpc('admin_empty_bin')) || 0;

// ---------------------------------------------------------------------------
// Password records (admin only)
// ---------------------------------------------------------------------------
export async function listCredentials(): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('admin_list_credentials');
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((r: any) => [r.user_id, r.password]));
}

export const resetUserPassword = (userId: string, password: string) =>
  rpc('admin_reset_user_password', { p_user_id: userId, p_password: password });

/** Called after a user changes their own password so the admin panel doesn't show a stale one. */
export async function notePasswordChanged(): Promise<void> {
  try { await supabase.rpc('note_my_password_changed'); } catch { /* not critical */ }
}
