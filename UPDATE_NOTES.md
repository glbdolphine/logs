# Pace IT update

1. Supabase -> SQL Editor -> paste and run `supabase_patch_v2.sql` (safe to run twice). Do this FIRST.
2. Copy the `src/` folder from this zip over your project's `src/` (same paths; overwrites existing files, adds new ones).
3. `npm run build` / redeploy right after the SQL (old app code can't load logs once the patch is applied).

New: Home dashboard, Reseller List tab, duplicate warnings (log form + Form Maker), follow-up dates with
Due today / Overdue filter, days-awaiting + WhatsApp reminders on signed forms, bin for deleted logs/resellers,
admin panel shows usernames + passwords and can reset them. Admins get an "Admin" entry in the sidebar (Esc, T still works).

Layout update: the top bar now only holds the menu button, brand, New Log and Lock. Pages (Home, Logs, Resellers,
Reseller List, Form Maker) and tools (Activity, Backup & Data, Saved Values, Admin) plus your name and Password
live in a new sidebar (`src/components/Sidebar.tsx`): it stays open on large screens (collapse it with the menu
button, it remembers your choice) and slides over the page on phones. The login page was rebuilt around one centre
line (`LoginScreen.tsx`, `LoginArt.tsx`, new pre-cropped logo `src/logo/logo-mark.jpg`).
