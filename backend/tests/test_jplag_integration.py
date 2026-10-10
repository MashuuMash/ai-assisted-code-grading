import shutil
from pathlib import Path

import pytest

from app.jplag_runner import run_jplag_cli


@pytest.mark.jplag
def test_real_jplag_report_is_parsed() -> None:
    jar = Path(__file__).resolve().parents[2] / "tools" / "jplag-6.2.0.jar"
    if not jar.is_file() or not shutil.which("java"):
        pytest.skip("Java or the optional JPlag JAR is unavailable")

    fixture_root = Path(__file__).parent / "fixtures" / "jplag"
    submissions = [
        (index, (fixture_root / f"sub_{index}" / "solution.py").read_text(encoding="utf-8"))
        for index in (1, 2)
    ]

    results = run_jplag_cli(submissions, jar_path=str(jar))

    assert results is not None
    assert (1, 2) in results
    assert results[(1, 2)].similarity_percentage > 90
    assert results[(1, 2)].matched_tokens > 0
    assert results[(1, 2)].matched_regions
