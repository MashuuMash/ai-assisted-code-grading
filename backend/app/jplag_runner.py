import hashlib
import io
import keyword
import logging
import os
import shutil
import subprocess
import tempfile
import tokenize
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Assignment,
    ComparisonReviewStatus,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    SimilarityComparison,
    SimilarityReport,
    SimilarityStatus,
    Submission,
    SubmissionEvidence,
)
from app.submission_storage import SubmissionStorage

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class TokenItem:
    kind: str
    line: int


@dataclass(frozen=True)
class KGram:
    hash_val: str
    start_line: int
    end_line: int


@dataclass
class PairwiseMatchResult:
    similarity_percentage: float
    matched_tokens: int
    matched_regions: list[dict[str, Any]]


def tokenize_python_code(source: str) -> list[TokenItem]:
    """Tokenize Python source into normalized tokens with line numbers.
    Keywords are preserved, user identifiers are normalized to 'ID',
    numbers to 'NUM', and strings to 'STR'.
    """
    tokens: list[TokenItem] = []
    if not source.strip():
        return tokens

    stream = io.BytesIO(source.encode("utf-8", errors="replace"))
    try:
        for tok in tokenize.tokenize(stream.readline):
            if tok.type in (
                tokenize.ENCODING,
                tokenize.ENDMARKER,
                tokenize.COMMENT,
                tokenize.NL,
            ):
                continue
            if tok.type == tokenize.NAME:
                kind = tok.string if keyword.iskeyword(tok.string) else "ID"
            elif tok.type == tokenize.NUMBER:
                kind = "NUM"
            elif tok.type == tokenize.STRING:
                kind = "STR"
            elif tok.type in (
                tokenize.OP,
                tokenize.INDENT,
                tokenize.DEDENT,
                tokenize.NEWLINE,
            ):
                kind = tok.string
            else:
                kind = tok.string
            tokens.append(TokenItem(kind=kind, line=tok.start[0]))
    except Exception:
        # Fallback to whitespace/character tokens for malformed syntax
        for line_no, line in enumerate(source.splitlines(), start=1):
            for word in line.split():
                tokens.append(TokenItem(kind=word, line=line_no))

    return tokens


def extract_kgrams(tokens: list[TokenItem], k: int = 4) -> list[KGram]:
    """Extract contiguous k-grams from tokens with line span tracking."""
    if not tokens:
        return []

    effective_k = min(k, len(tokens))
    if effective_k <= 0:
        return []

    kgrams: list[KGram] = []
    for i in range(len(tokens) - effective_k + 1):
        window = tokens[i : i + effective_k]
        token_str = " ".join(t.kind for t in window)
        h = hashlib.sha256(token_str.encode("utf-8")).hexdigest()
        start_line = window[0].line
        end_line = window[-1].line
        kgrams.append(KGram(hash_val=h, start_line=start_line, end_line=end_line))

    return kgrams


def compute_winnowing_fingerprints(
    kgrams: list[KGram], window_size: int = 4
) -> set[str]:
    """Apply Karp-Rabin winnowing algorithm to select minimum hash per window."""
    if not kgrams:
        return set()

    effective_w = min(window_size, len(kgrams))
    if effective_w <= 0:
        return {kg.hash_val for kg in kgrams}

    fingerprints: set[str] = set()
    for i in range(len(kgrams) - effective_w + 1):
        window = kgrams[i : i + effective_w]
        min_kg = min(window, key=lambda x: x.hash_val)
        fingerprints.add(min_kg.hash_val)

    return fingerprints


def _merge_regions(
    matching_pairs: list[tuple[int, int, int, int]],
) -> list[dict[str, Any]]:
    """Merge overlapping or adjacent line match spans into consolidated regions."""
    if not matching_pairs:
        return []

    sorted_pairs = sorted(matching_pairs, key=lambda x: (x[0], x[2]))
    merged: list[dict[str, Any]] = []

    current_a_start, current_a_end, current_b_start, current_b_end = sorted_pairs[0]

    for a_start, a_end, b_start, b_end in sorted_pairs[1:]:
        if a_start <= current_a_end + 1 and b_start <= current_b_end + 1:
            current_a_end = max(current_a_end, a_end)
            current_b_end = max(current_b_end, b_end)
        else:
            merged.append(
                {
                    "lines_a": [current_a_start, current_a_end],
                    "lines_b": [current_b_start, current_b_end],
                }
            )
            current_a_start, current_a_end = a_start, a_end
            current_b_start, current_b_end = b_start, b_end

    merged.append(
        {
            "lines_a": [current_a_start, current_a_end],
            "lines_b": [current_b_start, current_b_end],
        }
    )
    return merged


def calculate_token_similarity(
    source_a: str,
    source_b: str,
    base_source: str | None = None,
    k: int = 4,
    window_size: int = 4,
) -> PairwiseMatchResult:
    """Calculate token similarity between two source codes with base-code subtraction."""
    tokens_a = tokenize_python_code(source_a)
    tokens_b = tokenize_python_code(source_b)

    if not tokens_a and not tokens_b:
        return PairwiseMatchResult(
            similarity_percentage=0.0,
            matched_tokens=0,
            matched_regions=[],
        )

    if not tokens_a or not tokens_b:
        return PairwiseMatchResult(
            similarity_percentage=0.0,
            matched_tokens=0,
            matched_regions=[],
        )

    # Base code extraction & subtraction
    base_hashes: set[str] = set()
    if base_source and base_source.strip():
        base_tokens = tokenize_python_code(base_source)
        base_kgrams = extract_kgrams(base_tokens, k=k)
        base_hashes = {kg.hash_val for kg in base_kgrams}

    all_kgrams_a = extract_kgrams(tokens_a, k=k)
    all_kgrams_b = extract_kgrams(tokens_b, k=k)

    kgrams_a = [kg for kg in all_kgrams_a if kg.hash_val not in base_hashes]
    kgrams_b = [kg for kg in all_kgrams_b if kg.hash_val not in base_hashes]

    if not kgrams_a and not kgrams_b:
        return PairwiseMatchResult(
            similarity_percentage=0.0,
            matched_tokens=0,
            matched_regions=[],
        )

    fp_a = compute_winnowing_fingerprints(kgrams_a, window_size=window_size)
    fp_b = compute_winnowing_fingerprints(kgrams_b, window_size=window_size)

    intersection = fp_a.intersection(fp_b)
    total_fps = len(fp_a) + len(fp_b)

    if total_fps == 0:
        return PairwiseMatchResult(
            similarity_percentage=0.0,
            matched_tokens=0,
            matched_regions=[],
        )

    similarity_pct = round((2.0 * len(intersection) / total_fps) * 100.0, 2)
    similarity_pct = min(100.0, max(0.0, similarity_pct))

    # Match regions
    matching_spans: list[tuple[int, int, int, int]] = []
    lookup_b: dict[str, list[KGram]] = {}
    for kg in kgrams_b:
        if kg.hash_val in intersection:
            lookup_b.setdefault(kg.hash_val, []).append(kg)

    for kg_a in kgrams_a:
        if kg_a.hash_val in lookup_b:
            for kg_b in lookup_b[kg_a.hash_val]:
                matching_spans.append(
                    (kg_a.start_line, kg_a.end_line, kg_b.start_line, kg_b.end_line)
                )

    regions = _merge_regions(matching_spans)
    matched_tokens = len(intersection) * k

    return PairwiseMatchResult(
        similarity_percentage=similarity_pct,
        matched_tokens=matched_tokens,
        matched_regions=regions,
    )


def run_jplag_cli(
    submissions: list[tuple[int, str]],
    base_code: str | None = None,
    jar_path: str | None = None,
) -> dict[tuple[int, int], PairwiseMatchResult] | None:
    """Run official JPlag JAR CLI if configured and java executable is available."""
    if not jar_path or not os.path.isfile(jar_path):
        return None

    java_bin = shutil.which("java")
    if not java_bin:
        logger.warning("Java binary not found in PATH; skipping JPlag CLI execution")
        return None

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        subs_dir = tmp_path / "submissions"
        subs_dir.mkdir()

        for sub_id, code in submissions:
            sub_folder = subs_dir / f"sub_{sub_id}"
            sub_folder.mkdir()
            (sub_folder / "solution.py").write_text(code, encoding="utf-8")

        cmd = [
            java_bin,
            "-jar",
            jar_path,
            "-l",
            "python3",
            "-r",
            str(tmp_path / "result"),
        ]

        if base_code and base_code.strip():
            bc_dir = tmp_path / "base_code"
            bc_dir.mkdir()
            (bc_dir / "solution.py").write_text(base_code, encoding="utf-8")
            cmd.extend(["-bc", str(bc_dir)])

        cmd.append(str(subs_dir))

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
            if res.returncode != 0:
                logger.warning(
                    "JPlag CLI returned non-zero code %d: %s",
                    res.returncode,
                    res.stderr,
                )
                return None

            return None
        except Exception as ex:
            logger.warning("JPlag CLI execution failed: %s", ex)
            return None


def run_similarity_for_assignment(
    assignment_id: int,
    db: Session,
    threshold: float | None = None,
) -> SimilarityReport:
    """Execute similarity analysis across all latest submissions for an assignment.
    Persists SimilarityReport, SimilarityComparison records, and links
    SubmissionEvidence for pairs exceeding threshold.
    """
    settings = get_settings()
    effective_threshold = (
        threshold
        if threshold is not None
        else settings.similarity_default_threshold
    )

    assignment = db.scalar(select(Assignment).where(Assignment.id == assignment_id))
    if not assignment:
        raise ValueError(f"Assignment with ID {assignment_id} does not exist")

    submissions = db.scalars(
        select(Submission)
        .where(Submission.assignment_id == assignment_id)
        .order_by(Submission.submitted_at.desc())
    ).all()

    latest_by_student: dict[str, Submission] = {}
    for sub in submissions:
        dedup_key = (
            f"user_{sub.student_id}"
            if sub.student_id is not None
            else (f"ident_{sub.student_identifier}" if sub.student_identifier else f"sub_{sub.id}")
        )
        if dedup_key not in latest_by_student:
            latest_by_student[dedup_key] = sub

    target_submissions = sorted(latest_by_student.values(), key=lambda s: s.id)

    if len(target_submissions) < 2:
        report = SimilarityReport(
            assignment_id=assignment_id,
            status=SimilarityStatus.COMPLETED,
            threshold_used=effective_threshold,
            submission_count=len(target_submissions),
            avg_similarity=0.0,
            max_similarity=0.0,
            completed_at=utc_now(),
            error_message="At least 2 submissions are required for similarity analysis",
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    report = SimilarityReport(
        assignment_id=assignment_id,
        status=SimilarityStatus.RUNNING,
        threshold_used=effective_threshold,
        submission_count=len(target_submissions),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    try:
        storage = SubmissionStorage()
        sources_map: dict[int, str] = {}
        for sub in target_submissions:
            try:
                src_path = storage.source_path(sub.storage_key)
                if src_path.exists():
                    sources_map[sub.id] = src_path.read_text(
                        encoding="utf-8", errors="replace"
                    )
                else:
                    sources_map[sub.id] = ""
            except Exception:
                sources_map[sub.id] = ""

        base_code = assignment.base_code

        cli_results: dict[tuple[int, int], PairwiseMatchResult] | None = None
        if settings.jplag_jar_path:
            cli_input = [(s.id, sources_map.get(s.id, "")) for s in target_submissions]
            cli_results = run_jplag_cli(
                submissions=cli_input,
                base_code=base_code,
                jar_path=settings.jplag_jar_path,
            )

        comparisons: list[SimilarityComparison] = []
        n = len(target_submissions)

        for i in range(n):
            sub_a = target_submissions[i]
            source_a = sources_map.get(sub_a.id, "")

            for j in range(i + 1, n):
                sub_b = target_submissions[j]
                source_b = sources_map.get(sub_b.id, "")

                if cli_results and (sub_a.id, sub_b.id) in cli_results:
                    match_result = cli_results[(sub_a.id, sub_b.id)]
                else:
                    match_result = calculate_token_similarity(
                        source_a=source_a,
                        source_b=source_b,
                        base_source=base_code,
                    )

                comp = SimilarityComparison(
                    report_id=report.id,
                    submission_a_id=sub_a.id,
                    submission_b_id=sub_b.id,
                    similarity_percentage=match_result.similarity_percentage,
                    matched_tokens=match_result.matched_tokens,
                    status=ComparisonReviewStatus.UNREVIEWED,
                    matched_regions=match_result.matched_regions,
                )
                db.add(comp)
                comparisons.append(comp)

                if match_result.similarity_percentage >= effective_threshold:
                    severity = (
                        EvidenceSeverity.ERROR
                        if match_result.similarity_percentage >= 80.0
                        else EvidenceSeverity.WARNING
                    )
                    ev_a = SubmissionEvidence(
                        id=uuid.uuid4().hex,
                        submission_id=sub_a.id,
                        assignment_id=assignment_id,
                        source=EvidenceSource.JPLAG,
                        category=EvidenceCategory.SIMILARITY,
                        severity=severity,
                        rule_code="HIGH_SIMILARITY_DETECTED",
                        message=(
                            f"High similarity of {match_result.similarity_percentage:.1f}% "
                            f"detected with submission #{sub_b.id}"
                        ),
                        metric_value=match_result.similarity_percentage,
                        raw_data={
                            "report_id": report.id,
                            "matched_submission_id": sub_b.id,
                            "similarity_percentage": match_result.similarity_percentage,
                            "matched_tokens": match_result.matched_tokens,
                        },
                    )
                    ev_b = SubmissionEvidence(
                        id=uuid.uuid4().hex,
                        submission_id=sub_b.id,
                        assignment_id=assignment_id,
                        source=EvidenceSource.JPLAG,
                        category=EvidenceCategory.SIMILARITY,
                        severity=severity,
                        rule_code="HIGH_SIMILARITY_DETECTED",
                        message=(
                            f"High similarity of {match_result.similarity_percentage:.1f}% "
                            f"detected with submission #{sub_a.id}"
                        ),
                        metric_value=match_result.similarity_percentage,
                        raw_data={
                            "report_id": report.id,
                            "matched_submission_id": sub_a.id,
                            "similarity_percentage": match_result.similarity_percentage,
                            "matched_tokens": match_result.matched_tokens,
                        },
                    )
                    db.add(ev_a)
                    db.add(ev_b)

        sim_scores = [c.similarity_percentage for c in comparisons]
        avg_sim = round(sum(sim_scores) / len(sim_scores), 2) if sim_scores else 0.0
        max_sim = max(sim_scores, default=0.0)

        report.status = SimilarityStatus.COMPLETED
        report.avg_similarity = avg_sim
        report.max_similarity = max_sim
        report.completed_at = utc_now()
        db.commit()
        db.refresh(report)
        return report

    except Exception as exc:
        logger.exception("Error executing similarity analysis: %s", exc)
        report.status = SimilarityStatus.FAILED
        report.error_message = str(exc)
        report.completed_at = utc_now()
        db.commit()
        db.refresh(report)
        raise
