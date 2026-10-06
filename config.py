"""
config.py
==========
Everything you'll ever need to touch when the institute workbook's layout
changes, a new sheet with a different column order shows up, or the docx
template's label text changes. Nothing else in this tool should need
editing for those situations — if you find yourself editing formly/*.py
for a data-shape reason instead of a logic reason, that value probably
belongs in this file instead.

Sections below:
    1. Paths
    2. Workbook column mapping  (HEADER_ALIASES / SKIP_SHEETS / POSITIONAL_FALLBACK)
    3. Form fields shown when prompting for missing data
    4. Docx template label text (LABELS)
"""

from pathlib import Path

# ===========================================================================
# 1. Paths
# ===========================================================================

# This project's root folder (where this file, EDC Form.docx, and — once
# you've installed the global `formly` command — the .banner file all
# live). Everything below is resolved relative to here, so `formly` works
# the same whether you launch it with `python main.py` from this folder
# or as the global `formly` command from anywhere else on the machine.
BASE_DIR = Path(__file__).resolve().parent

# The docx template. Must exist in this folder.
TEMPLATE_PATH = BASE_DIR / "template" / "EDC Form.docx"

# Suggested default workbook path shown at the prompt — you can always type
# a different path when the tool asks. Resolved against BASE_DIR (this
# project's own folder), not the current working directory, so it's found
# whether you run `formly` from inside this folder or from anywhere else
# on the machine.
DEFAULT_WORKBOOK_PATH = BASE_DIR / "data-source" / "toscrape.xlsx"

# Where generated forms are saved. Every filled form is exported as BOTH
# a .docx and a .pdf, side by side in this folder.
OUTPUT_DIR = BASE_DIR / "generated_forms"

# The ASCII/figlet banner shown at the top of the cockpit, loaded as plain
# text from this file — nothing in the code hardcodes a tool name. Replace
# the file's contents with whatever art/branding you want; if it's
# missing, the tool just skips the banner and carries on.
BANNER_PATH = BASE_DIR / ".banner"

# Path to LibreOffice's soffice binary, used to export forms straight to
# PDF. Leave as None to auto-detect it — this works on Windows, and on
# Linux distros that ship it as `soffice`/`libreoffice` (Debian, Ubuntu,
# Mint, Fedora, Arch, etc.), and on macOS. Only set this yourself if it's
# installed somewhere non-standard, e.g.:
#   LIBREOFFICE_PATH = r"D:\Apps\LibreOffice\program\soffice.exe"          # Windows
#   LIBREOFFICE_PATH = "/opt/libreoffice7.6/program/soffice"              # Linux
LIBREOFFICE_PATH = None


# ===========================================================================
# 2. Workbook column mapping
# ===========================================================================

# Every header text variant seen for each field. normalize_header() (in
# formly/workbook.py) strips spaces/periods/case before comparing, so
# you don't need to worry about that when adding a new alias — just paste
# the exact header text from the sheet.
#
# If a column in your workbook isn't being picked up: open the sheet,
# copy the exact header cell text, and add it to the right list below.
HEADER_ALIASES = {
    "edc_number": ["ক্রমিক নং", "ক্রমিক নং.", "EDC Book No.", "EDC Book No"],
    "name": ["প্রতিষ্ঠানের/অফিসের নাম", "Institute/Organization Name", "প্রতিষ্ঠানের নাম", "Institution Name"],
    "mobile": ["মোবাইল নং", "Contact Person Mobile No.", "মোবাইল নাম্বার", "Mobile No", "Mobile"],
    "union": ["ইউনিয়নের নাম", "ইউনিয়ন/পৌরসভা (ওয়ার্ড)", "ইউনিয়ন", "Union"],
    "upazila": ["থানা", "উপজেলা", "Upazila", "Thana"],
    "connection_nms": ["সংযোগ/NMS আইডি", "NMS ID", "NMS", "Connection/NMS ID", "Connection ID"],
    "institution_code": ["প্রতিষ্টানের কোড (EMIS/EIIN/OTHERS)", "EMIS/EIIN/OTHERS", "EMIS Code", "EMIS_CODE", "EIIN", "Institution Code"],
    "lat_long": ["Lat & Long", "Lat/Long", "Latitude & Longitude"],
    "lat": ["Lat", "Latitude"],
    "long": ["Long", "Longitude"],
    "router_serial": ["Router Serial", "Wi-Fi Router Serial No.", "Router Serial No"],
    "router_mac": ["MAC Address", "Router MAC", "Wi-Fi Router MAC Address"],
}

# A header row must contain all of these (via the aliases above) before
# it's accepted as the header row for a sheet.
REQUIRED_FIELDS = ["edc_number"]

# Master/summary sheets that just duplicate per-upazila data — add sheet
# names here to skip them during search.
SKIP_SHEETS = {"SD-133"}

# Fallback for sheets with NO header row at all (data starts straight at
# row 1, but sits in the same column positions every other sheet in the
# workbook uses). Column numbers are 1-indexed (col B = 2, col I = 9, ...).
# Confirmed against the real toscrape.xlsx: EDC No.=B, Upazila=F, Union=G,
# Institute Name=I, Mobile=K, EMIS Code=M.
# Set to {} to disable the fallback (sheets without a header row will then
# just be skipped, same as before).
POSITIONAL_FALLBACK = {
    "edc_number": 2, "upazila": 6, "union": 7, "name": 9,
    "mobile": 11, "institution_code": 13,
}

# How many rows (from the top) to scan for a header row before giving up
# and trying the positional fallback.
MAX_SCAN_ROWS_FOR_HEADER = 15

# Some sheets report a bogus max_row (Excel formatting applied far past the
# real data), which would otherwise make a full scan crawl through hundreds
# of thousands of empty rows. Hard cap + early-exit on a long empty streak.
MAX_DATA_ROWS_PER_SHEET = 5000
EMPTY_ROW_STREAK_BREAK = 200


# ===========================================================================
# 3. Form fields
#    (key, prompt label shown in the terminal, default value if none found)
#    Order here is the order fields are asked for when missing.
# ===========================================================================

FORM_FIELDS = [
    ("name", "প্রতিষ্ঠানের নাম (Institute Name)", ""),
    ("mobile", "মোবাইল নাম্বার (Mobile)", ""),
    ("union", "ইউনিয়নের নাম (Union)", ""),
    ("upazila", "উপজেলা/থানা (Upazila)", ""),
    ("source_no", "EDC Book No. / সুত্র নং", ""),
    ("connection_nms", "সংযোগ/NMS আইডি", ""),
    ("institution_code", "প্রতিষ্টানের কোড (EMIS/EIIN/OTHERS)", ""),
    ("lat_long", "Lat & Long", ""),
    ("router_serial", "রাউটার সিরিয়াল নাম্বার", ""),
    ("router_mac", "MAC address", ""),
    ("cable_brand", "Optical Fiber Cable Brand", "BRB"),
    ("cable_qty", "Optical Fiber Cable Qty (meters)", "1500"),
]


# ===========================================================================
# 4. Docx template label text
#    The exact text the template uses right before each value. If you
#    change the wording in EDC Form.docx, mirror the change here.
# ===========================================================================

LABELS = {
    "edc_book": ["EDC Book No.:"],
    "connection_nms": ["সংযোগ/NMS আইডিঃ"],
    "address": ["সংযোগ গ্রহণকারী প্রতিষ্টানের নাম ও ঠিকানাঃ"],
    "lat_long": ["Lat & Long:"],
    "union": ["ইউনিয়ন/পৌরসভা (ওয়ার্ড):"],
    "upazila": ["উপজেলা/সিটি কর্পোরেশনঃ"],
    "institution_code": ["প্রতিষ্টানের কোড (EMIS/EIIN/OTHERS):"],
    "date": ["সংযোগ প্রদানের তারিখঃ"],
    "router_mac": ["Wi-Fi Router MAC Address(Upon which API will be called):"],
    "router_serial": ["Wi-Fi Router Serial No.:"],
    "cable_brand": ["Optical Fiber Cable Brand:"],
}

HEADER_SOURCE_NO_LABELS = ["সুত্র নংঃ", "সুত্র নং:", "সুত্র নং"]
HEADER_DATE_LABELS = ["তারিখঃ"]

BANGLA_FONT = "Nikosh"
ENGLISH_FONT = "Times New Roman"
