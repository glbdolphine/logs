"""Pre-builds data/index.json from data-source/toscrape.xlsx so the serverless
function never has to parse the 17 MB workbook. Re-run after the workbook changes:
    python scripts/build_index.py
"""
import json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from config import DEFAULT_WORKBOOK_PATH
from formly.workbook import build_workbook_index, match_to_form_data

raw, warnings = build_workbook_index(DEFAULT_WORKBOOK_PATH)
index = {k: [{"sheet": m["sheet"], "data": match_to_form_data(m, m["sheet"])} for m in v] for k, v in raw.items()}
out = ROOT / "data" / "index.json"
out.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(index)} EDC keys -> {out} ({out.stat().st_size/1024:.0f} KB)")
