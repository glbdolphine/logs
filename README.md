# Pace IT - Every record. One workground.

The Pace IT workground: reseller logs, **Reseller Supply** report, and the EDC Form Maker in one Vercel project.
Name and slogan live in `src/brand.ts`.

- **Reseller Supply tab:** per-reseller count of how many user IDs (request type "New User ID") they have taken, with From/To date filtering, drill-down to each entry, and Excel export.

- **Frontend:** Vite + React (`src/`). New **Form Maker** tab.
- **API:** Python/Flask on Vercel (`api/index.py`) - looks up an EDC number, fills the `.docx`.
- **Data:** Supabase (unchanged). Logs now also store `edcNo` and `routerSerial` (inside the existing JSON `data` column, so no SQL migration is needed).

## How it works
Form Maker -> look up EDC no. -> review fields -> **Download form & log it**.
When the download succeeds, a log is created through the normal `saveLog()` path:
date, request type "New User ID", customer name, NMS ID, MAC, EDC Book No., Router Serial No.
Everything else gets the log form's usual defaults. Fill in issues etc. later via Edit.
Downloading the same form again in the same session updates its log instead of duplicating it.

## Signed-form tracking
Every log with request type "New User ID" automatically expects one signed form back (nothing to set up).
- Mark received: click the **Form** chip on a log row/card, or **Mark form received** inside the log. Stored as `formReceivedAt` in the log's JSON `data` (no SQL migration).
- **Forms x/y** button in the logs toolbar: overall progress, per-reseller counts (click one to list its awaiting forms), All/Awaiting/Received filter, Export (all / awaiting only) and Import received.
- Search by NMS ID with the normal search box; the chip shows whether the form is in.
- Import reads an Excel/CSV with an NMS ID column (optional "Form Received" Yes/No and "Received On" columns), shows a preview, and only ever marks forms received.

## Deploy (Vercel)
Environment variables (Project Settings -> Environment Variables), same values Pace IT already uses:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The API reads these to check that the caller is a logged-in Pace IT user. Requests without a valid login get 401.
Use a **private** repo: `data/index.json` contains institute names and phone numbers.

## When the workbook changes
Put the new file at `data-source/toscrape.xlsx`, then run `python scripts/build_index.py` and redeploy.
(`data-source/` is git-ignored and never deployed; only `data/index.json` is.)

## Local dev
```bash
npm install
pip install -r requirements.txt
export SUPABASE_URL=...  SUPABASE_ANON_KEY=...   # same as .env.local
python run_local.py      # API on :5001
npm run dev              # app on :3000, /api proxied to :5001
```
