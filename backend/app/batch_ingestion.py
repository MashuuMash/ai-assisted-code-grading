import io
import logging
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

from sqlalchemy.orm import Session

from app.models import GradingJob, GradingJobStatus, Submission
from app.schemas import BatchUploadItem, BatchUploadResponse
from app.submission_storage import SubmissionStorage

logger = logging.getLogger(__name__)

MAX_ZIP_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_FILE_COUNT = 500


@dataclass
class ParsedStudentMeta:
    student_identifier: str
    student_name: str | None
    clean_filename: str


def parse_submission_metadata(rel_path: str) -> ParsedStudentMeta:
    normalized = rel_path.replace("\\", "/").strip("/")
    parts = normalized.split("/")

    # Check for Moodle pattern: "Student Name_123456_assignsubmission_file_..."
    moodle_regex = re.compile(
        r"^(.+?)_([0-9A-Za-z]+)_assignsubmission_file(?:_(.+))?$",
        re.IGNORECASE,
    )

    # 1. Check folder name first
    if len(parts) > 1:
        folder_name = parts[0]
        filename = parts[-1]
        moodle_match = moodle_regex.match(folder_name)
        if moodle_match:
            name, sid, _ = moodle_match.groups()
            return ParsedStudentMeta(
                student_identifier=sid.strip(),
                student_name=name.strip(),
                clean_filename=filename,
            )

        # Google Classroom folder: "Student Name/filename.py"
        if " - " in folder_name:
            folder_parts = folder_name.split(" - ", 1)
            return ParsedStudentMeta(
                student_identifier=folder_parts[0].strip(),
                student_name=folder_parts[0].strip(),
                clean_filename=filename,
            )

        # Generic student folder: "SV123456/main.py" or "Nguyen Van A/main.py"
        return ParsedStudentMeta(
            student_identifier=folder_name.strip(),
            student_name=folder_name.strip() if not folder_name.isalnum() else None,
            clean_filename=filename,
        )

    # 2. Check single flat filename in root
    filename = parts[0]
    stem = Path(filename).stem
    ext = Path(filename).suffix

    moodle_match = moodle_regex.match(stem)
    if moodle_match:
        name, sid, rest = moodle_match.groups()
        actual_name = f"{rest}{ext}" if rest else filename
        return ParsedStudentMeta(
            student_identifier=sid.strip(),
            student_name=name.strip(),
            clean_filename=actual_name,
        )

    # Google Classroom flat filename: "Student Name - filename.py"
    if " - " in stem:
        name_part, rest = stem.split(" - ", 1)
        return ParsedStudentMeta(
            student_identifier=name_part.strip(),
            student_name=name_part.strip(),
            clean_filename=f"{rest}{ext}",
        )

    # Canvas pattern: "studentname_123456_789012_filename.py"
    canvas_match = re.match(r"^([a-z0-9_]+)_([0-9]+)_[0-9]+_(.+)$", stem, re.IGNORECASE)
    if canvas_match:
        name_slug, sid, rest = canvas_match.groups()
        return ParsedStudentMeta(
            student_identifier=sid,
            student_name=name_slug.replace("_", " ").title(),
            clean_filename=f"{rest}{ext}",
        )

    # Simple ID pattern: "SV123456_solution.py" or "SV123456.py"
    id_match = re.match(r"^([A-Za-z0-9]+)(?:_(.+))?$", stem)
    if id_match:
        sid, rest = id_match.groups()
        clean = f"{rest}{ext}" if rest else filename
        return ParsedStudentMeta(
            student_identifier=sid,
            student_name=None,
            clean_filename=clean,
        )

    return ParsedStudentMeta(
        student_identifier=stem,
        student_name=None,
        clean_filename=filename,
    )


def validate_zip_archive(zip_file: zipfile.ZipFile) -> Tuple[bool, str | None]:
    total_uncompressed = 0
    file_count = 0

    for info in zip_file.infolist():
        file_count += 1
        if file_count > MAX_FILE_COUNT:
            return False, f"Archive exceeds maximum allowed file count of {MAX_FILE_COUNT}"

        # Zip Slip vulnerability protection
        norm_name = info.filename.replace("\\", "/")
        if norm_name.startswith("/") or ".." in norm_name.split("/"):
            return False, f"Illegal file path in archive: {info.filename}"

        total_uncompressed += info.file_size
        if total_uncompressed > MAX_UNCOMPRESSED_SIZE:
            return False, f"Uncompressed size exceeds limit of {MAX_UNCOMPRESSED_SIZE // (1024 * 1024)}MB"

    return True, None


def ingest_batch_zip(
    db: Session,
    assignment_id: int,
    archive_bytes: bytes,
    auto_queue: bool = True,
    storage: SubmissionStorage | None = None,
) -> BatchUploadResponse:
    if len(archive_bytes) > MAX_ZIP_SIZE:
        raise ValueError(f"Archive file size exceeds limit of {MAX_ZIP_SIZE // (1024 * 1024)}MB")

    try:
        zip_buffer = io.BytesIO(archive_bytes)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            valid, err = validate_zip_archive(zf)
            if not valid:
                raise ValueError(err)

            storage_mgr = storage or SubmissionStorage()
            submissions_created: list[BatchUploadItem] = []
            errors: list[str] = []
            total_found = 0

            for info in zf.infolist():
                if info.is_dir():
                    continue

                clean_path = info.filename.replace("\\", "/")
                # Skip macOS metadata and hidden files
                if "/__MACOSX/" in f"/{clean_path}" or Path(clean_path).name.startswith("."):
                    continue

                if not clean_path.endswith(".py"):
                    continue

                total_found += 1
                try:
                    file_content = zf.read(info.filename)
                except Exception as exc:
                    errors.append(f"Failed to read {info.filename}: {exc}")
                    continue

                if not file_content:
                    errors.append(f"Skipped {info.filename}: empty file")
                    continue

                if b"\x00" in file_content:
                    errors.append(f"Skipped {info.filename}: null bytes detected")
                    continue

                meta = parse_submission_metadata(clean_path)

                try:
                    saved = storage_mgr.store_bytes(file_content, meta.clean_filename)
                except Exception as exc:
                    errors.append(f"Storage failed for {info.filename}: {exc}")
                    continue

                sub = Submission(
                    assignment_id=assignment_id,
                    student_id=None,
                    student_identifier=meta.student_identifier,
                    student_name=meta.student_name,
                    original_filename=meta.clean_filename,
                    storage_key=saved.storage_key,
                    size_bytes=saved.size_bytes,
                    sha256=saved.sha256,
                )
                db.add(sub)
                db.flush()

                job_id = None
                if auto_queue:
                    job = GradingJob(
                        submission_id=sub.id,
                        status=GradingJobStatus.QUEUED,
                    )
                    db.add(job)
                    db.flush()
                    job_id = job.id

                submissions_created.append(
                    BatchUploadItem(
                        submission_id=sub.id,
                        student_identifier=meta.student_identifier,
                        student_name=meta.student_name,
                        filename=meta.clean_filename,
                        size_bytes=saved.size_bytes,
                        job_id=job_id,
                    )
                )

            db.commit()

            return BatchUploadResponse(
                total_found=total_found,
                imported_count=len(submissions_created),
                failed_count=len(errors),
                submissions=submissions_created,
                errors=errors,
            )

    except zipfile.BadZipFile:
        raise ValueError("Provided file is not a valid ZIP archive")
