import hashlib
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.config import get_settings

ALLOWED_CONTENT_TYPES = {"text/x-python", "text/plain", "application/octet-stream"}
SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]")


@dataclass(frozen=True)
class StoredSource:
    original_filename: str
    storage_key: str
    size_bytes: int
    sha256: str


class SubmissionStorage:
    def __init__(self) -> None:
        settings = get_settings()
        self.root = Path(settings.submission_storage_path).resolve()
        self.max_bytes = settings.submission_max_bytes

    async def store(self, upload: UploadFile) -> StoredSource:
        original_filename = self._validate_filename(upload.filename)
        if upload.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Unsupported file type. Only Python source files are accepted.",
            )

        self.root.mkdir(parents=True, exist_ok=True)
        storage_key = f"{uuid4().hex}.py"
        destination = self._path_for(storage_key)
        temporary = self._path_for(f"{uuid4().hex}.tmp")
        digest = hashlib.sha256()
        size = 0

        try:
            with temporary.open("xb") as target:
                while chunk := await upload.read(64 * 1024):
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Source file exceeds the {self.max_bytes}-byte limit",
                        )
                    if b"\x00" in chunk:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail="Python source must not contain null bytes",
                        )
                    digest.update(chunk)
                    target.write(chunk)

            if size == 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Source file is empty",
                )
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
            await upload.close()

        return StoredSource(
            original_filename=original_filename,
            storage_key=storage_key,
            size_bytes=size,
            sha256=digest.hexdigest(),
        )

    def store_bytes(self, content: bytes, filename: str) -> StoredSource:
        original_filename = self._validate_filename(filename)
        if len(content) > self.max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Source file exceeds the {self.max_bytes}-byte limit",
            )
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Source file is empty",
            )
        if b"\x00" in content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Python source must not contain null bytes",
            )

        self.root.mkdir(parents=True, exist_ok=True)
        storage_key = f"{uuid4().hex}.py"
        destination = self._path_for(storage_key)
        temporary = self._path_for(f"{uuid4().hex}.tmp")

        try:
            temporary.write_bytes(content)
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)

        return StoredSource(
            original_filename=original_filename,
            storage_key=storage_key,
            size_bytes=len(content),
            sha256=hashlib.sha256(content).hexdigest(),
        )

    def source_path(self, storage_key: str) -> Path:
        return self._path_for(storage_key)

    def delete(self, storage_key: str) -> None:
        self._path_for(storage_key).unlink(missing_ok=True)

    def _path_for(self, storage_key: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{32}\.(?:py|tmp)", storage_key):
            raise ValueError("Invalid storage key")
        path = (self.root / storage_key).resolve()
        if path.parent != self.root:
            raise ValueError("Storage path escaped its root")
        return path

    @staticmethod
    def _validate_filename(filename: str | None) -> str:
        if not filename or "\x00" in filename:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="A valid filename is required",
            )
        normalized = filename.replace("\\", "/")
        if PurePosixPath(normalized).name != normalized:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Filename must not contain directory paths",
            )
        sanitized = SAFE_FILENAME_PATTERN.sub("_", normalized).strip(".")
        if not sanitized or Path(sanitized).suffix.lower() != ".py":
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only .py files are accepted",
            )
        return sanitized[:255]
