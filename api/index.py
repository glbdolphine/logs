import io, json, os, sys, time, urllib.request
from datetime import datetime
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from flask import Flask, jsonify, request, send_file
from config import TEMPLATE_PATH, DEFAULT_WORKBOOK_PATH, FORM_FIELDS
from formly.docx_engine import fill_form, sanitize_filename, normalize_mac, get_bangla_date
from formly.workbook import normalize_key

app = Flask(__name__)

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY") or ""
INDEX_PATH = os.path.join(ROOT, "data", "index.json")

_index = None
_token_cache = {}  # token -> expiry timestamp (short cache, avoids a Supabase call per request)


def get_index():
    """Prefer the pre-built JSON index; fall back to parsing the workbook."""
    global _index
    if _index is None:
        if os.path.exists(INDEX_PATH):
            with open(INDEX_PATH, encoding="utf-8") as f:
                _index = json.load(f)
        else:
            from formly.workbook import build_workbook_index, match_to_form_data
            raw, _w = build_workbook_index(DEFAULT_WORKBOOK_PATH)
            _index = {k: [{"sheet": m["sheet"], "data": match_to_form_data(m, m["sheet"])} for m in v]
                      for k, v in raw.items()}
    return _index


def verify_token(token):
    """Accept only a valid, current Supabase session token (same login as Pace-IT)."""
    if not token or not SUPABASE_URL or not SUPABASE_KEY:
        return False
    if _token_cache.get(token, 0) > time.time():
        return True
    req = urllib.request.Request(f"{SUPABASE_URL}/auth/v1/user",
                                 headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            ok = r.status == 200
    except Exception:
        ok = False
    if ok:
        if len(_token_cache) > 200:
            _token_cache.clear()
        _token_cache[token] = time.time() + 60
    return ok


@app.before_request
def guard():
    if request.path == "/api/meta":
        return None
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify(error="Server auth is not configured (set SUPABASE_URL and SUPABASE_ANON_KEY)."), 500
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not verify_token(token):
        return jsonify(error="Please log in again."), 401


@app.get("/api/meta")
def meta():
    return jsonify(fields=[{"key": k, "label": l, "default": d} for k, l, d in FORM_FIELDS])


@app.get("/api/lookup")
def lookup():
    key = normalize_key(request.args.get("edc", ""))
    return jsonify(matches=get_index().get(key, []) if key else [])


@app.post("/api/generate")
def generate():
    body = request.get_json(silent=True) or {}
    data = {k: str(body.get("data", {}).get(k, "")).strip() for k, _l, _d in FORM_FIELDS}
    for k, _l, d in FORM_FIELDS:
        if not data[k] and d:
            data[k] = d
    if data["router_mac"]:
        data["router_mac"] = normalize_mac(data["router_mac"])
    try:
        dt = datetime.strptime(body.get("date", ""), "%Y-%m-%d")
    except ValueError:
        return jsonify(error="Invalid date"), 400
    data["date"] = get_bangla_date(dt)

    buf = io.BytesIO()
    fill_form(TEMPLATE_PATH, buf, data)
    buf.seek(0)
    base = sanitize_filename(data["connection_nms"] or data["source_no"] or data["name"])
    resp = send_file(buf, as_attachment=True, download_name=f"{base}.docx",
                     mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    resp.headers["X-Filename"] = quote(f"{base}.docx")
    resp.headers["X-Mac"] = data["router_mac"]
    return resp
