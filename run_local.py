# Local API for `npm run dev` (Vite proxies /api -> :5001). Needs SUPABASE_URL / SUPABASE_ANON_KEY
# (falls back to VITE_* names, so export them from .env.local first).
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "api"))
from index import app
app.run(port=5001, debug=True)
