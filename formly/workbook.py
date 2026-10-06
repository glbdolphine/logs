"""
formly/workbook.py
==========================
Reads the institute workbook (read-only) and builds an index of
EDC number -> row data across every sheet.

Handles three real-world quirks seen in the actual workbook:
  - Old-style vs new-style header text (HEADER_ALIASES in config.py)
  - Some sheets having their header row on row 2 instead of row 1
  - At least one sheet (সিলেট সদর) having NO header row at all, relying on
    the same fixed column positions every other sheet uses
    (POSITIONAL_FALLBACK in config.py)
  - A few sheets reporting a bogus max_row far past the real data, which
    would otherwise make a naive scan crawl through empty rows

All of the field/column knowledge lives in config.py — this module is the
mechanism, not the data.
"""

import re
import unicodedata

from config import (
    HEADER_ALIASES, REQUIRED_FIELDS, SKIP_SHEETS, POSITIONAL_FALLBACK,
    MAX_SCAN_ROWS_FOR_HEADER, MAX_DATA_ROWS_PER_SHEET, EMPTY_ROW_STREAK_BREAK,
)
from .docx_engine import normalize_mac


def normalize_header(text):
    """Loosely normalize a header cell for matching (strip spaces/periods/case).

    Also applies Unicode NFC normalization — Bangla conjuncts like "য়" can
    be stored as either one precomposed codepoint or a decomposed
    base+combining-mark sequence. Both render identically and look
    identical in an editor, but compare unequal as raw text unless
    normalized to the same form first. Without this, a header and its
    alias can look character-for-character the same and still fail to
    match.
    """
    if text is None:
        return ""
    text = unicodedata.normalize("NFC", str(text))
    return re.sub(r"[.\s]+", "", text).strip().lower()


def normalize_key(value):
    """
    Normalize an EDC number value for comparison. Handles values that come
    through as int, float (e.g. 5.0), or string.
    """
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    s = str(value).strip()
    if s == "":
        return None
    if re.fullmatch(r"-?\d+\.0", s):
        s = s[:-2]
    return s


def _alias_to_field_map():
    m = {}
    for field, aliases in HEADER_ALIASES.items():
        for alias in aliases:
            m[normalize_header(alias)] = field
    return m


def _find_header_row(ws, alias_to_field, max_scan_rows=MAX_SCAN_ROWS_FOR_HEADER):
    max_row = min(max_scan_rows, ws.max_row or max_scan_rows)
    for r in range(1, max_row + 1):
        field_map = {}
        for c in range(1, (ws.max_column or 30) + 1):
            val = ws.cell(row=r, column=c).value
            if val is None:
                continue
            field = alias_to_field.get(normalize_header(val))
            if field and field not in field_map:
                field_map[field] = c
        if all(f in field_map for f in REQUIRED_FIELDS):
            return r, field_map
    return None, {}


def build_workbook_index(xlsx_path):
    """
    Scan every sheet (read-only), return:
        (index, warnings)
    where index is {normalized_edc_key: [match_dict, ...]} and warnings is
    a list of human-readable strings about anything notable that happened
    during indexing (e.g. a sheet using the positional fallback).
    """
    import openpyxl

    alias_to_field = _alias_to_field_map()
    wb = openpyxl.load_workbook(xlsx_path, data_only=True, read_only=True)
    index = {}
    warnings = []

    for sheet_name in wb.sheetnames:
        if sheet_name.strip() in SKIP_SHEETS:
            continue
        ws = wb[sheet_name]
        header_row, field_map = _find_header_row(ws, alias_to_field)

        if header_row is None:
            # No recognizable header row anywhere in the sheet — fall back
            # to the fixed column layout the rest of the workbook uses.
            if not POSITIONAL_FALLBACK:
                warnings.append(f"'{sheet_name}': no header row found and no positional fallback configured — sheet skipped.")
                continue
            header_row = 0
            field_map = dict(POSITIONAL_FALLBACK)
            warnings.append(f"'{sheet_name}': no header row found, used positional fallback columns.")

        if "edc_number" not in field_map:
            warnings.append(f"'{sheet_name}': header row found but no EDC number column recognized — sheet skipped.")
            continue

        edc_col = field_map["edc_number"]

        # Some sheets report a bogus max_row (formatting applied far past
        # the real data), which makes a naive full scan crawl through
        # hundreds of thousands of empty rows. Cap the scan and bail out
        # early once we hit a long stretch of nothing.
        scan_limit = min(ws.max_row or MAX_DATA_ROWS_PER_SHEET, MAX_DATA_ROWS_PER_SHEET)
        empty_streak = 0
        for row in ws.iter_rows(min_row=header_row + 1, max_row=scan_limit, values_only=True):
            if all(v is None for v in row):
                empty_streak += 1
                if empty_streak > EMPTY_ROW_STREAK_BREAK:
                    break
                continue
            empty_streak = 0

            if edc_col - 1 >= len(row):
                continue
            key = normalize_key(row[edc_col - 1])
            if key is None:
                continue
            match = {"sheet": sheet_name}
            for field, col in field_map.items():
                val = row[col - 1] if col - 1 < len(row) else None
                match[field] = str(val).strip() if val is not None else ""
            index.setdefault(key, []).append(match)

    wb.close()
    return index, warnings


def match_to_form_data(match, sheet_name):
    """Translate a raw workbook match into the form's field keys."""
    data = {}
    data["name"] = match.get("name", "")
    data["mobile"] = match.get("mobile", "")
    data["union"] = match.get("union", "")
    data["upazila"] = match.get("upazila") or sheet_name
    data["source_no"] = match.get("edc_number", "")
    data["connection_nms"] = match.get("connection_nms", "")
    data["institution_code"] = match.get("institution_code", "")

    lat_long = match.get("lat_long", "")
    if not lat_long:
        lat = match.get("lat", "")
        long_ = match.get("long", "")
        if lat and long_:
            lat_long = f"{lat}, {long_}"
    data["lat_long"] = lat_long

    data["router_serial"] = match.get("router_serial", "")
    data["router_mac"] = normalize_mac(match.get("router_mac", ""))
    return data
