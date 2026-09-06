import csv
import hashlib
import io
import os
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

MAX_UNCOMPRESSED_SIZE_BYTES = 200 * 1024 * 1024  # 200 MB
MAX_FILES_COUNT = 500

class IngestionError(Exception):
    pass

def compute_sha256(file_bytes: bytes) -> str:
    hasher = hashlib.sha256()
    hasher.update(file_bytes)
    return hasher.hexdigest()

def extract_safe_zip(zip_bytes: bytes) -> Dict[str, Dict[str, str]]:
    """
    Safely unpacks a ZIP archive containing submissions.
    Guards against ZipSlip path traversal and resource exhaustion.
    Returns a dict mapping student_folder/identifier to a dict of {rel_path: content}.
    """
    submissions_map: Dict[str, Dict[str, str]] = {}
    total_uncompressed = 0
    file_count = 0

    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for zip_info in zf.infolist():
                # Defend against zip bombs
                file_count += 1
                if file_count > MAX_FILES_COUNT:
                    raise IngestionError(f"Archive contains too many files (exceeds limit of {MAX_FILES_COUNT})")

                total_uncompressed += zip_info.file_size
                if total_uncompressed > MAX_UNCOMPRESSED_SIZE_BYTES:
                    raise IngestionError(f"Uncompressed archive exceeds size limit of {MAX_UNCOMPRESSED_SIZE_BYTES // (1024*1024)}MB")

                # Defend against ZipSlip
                filename = zip_info.filename.replace("\\", "/")
                parts = Path(filename).parts
                if any(p == ".." or p.startswith("/") or p.startswith("\\") for p in parts):
                    continue  # Ignore unsafe path traversal entry

                # Ignore directories and non-python files
                if zip_info.is_dir() or not filename.endswith(".py"):
                    continue

                # Parse student identification from top-level directory or filename
                # e.g., "19120001_NguyenVanA/solution.py" -> student: "19120001_NguyenVanA", rel_path: "solution.py"
                # or "19120001.py" -> student: "19120001", rel_path: "solution.py"
                if len(parts) > 1:
                    student_key = parts[0]
                    rel_path = "/".join(parts[1:])
                else:
                    student_key = Path(parts[0]).stem
                    rel_path = "solution.py"

                try:
                    with zf.open(zip_info) as f:
                        content = f.read().decode("utf-8", errors="replace")
                except Exception:
                    continue

                if student_key not in submissions_map:
                    submissions_map[student_key] = {}
                submissions_map[student_key][rel_path] = content

    except zipfile.BadZipFile:
        raise IngestionError("Uploaded file is not a valid ZIP archive")

    return submissions_map

def parse_roster_csv(csv_content: str) -> Dict[str, str]:
    """
    Parses a roster CSV with headers such as 'student_id', 'student_name' (or 'id', 'name').
    Returns a dict of student_identifier -> student_name.
    """
    roster = {}
    reader = csv.DictReader(io.StringIO(csv_content))
    for row in reader:
        # Normalize keys
        lowered = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        sid = lowered.get("student_id") or lowered.get("id") or lowered.get("mssv")
        name = lowered.get("student_name") or lowered.get("name") or lowered.get("ho_ten") or sid
        if sid:
            roster[sid] = name
    return roster
