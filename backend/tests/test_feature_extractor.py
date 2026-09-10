import time
import numpy as np
import pytest
from app.ai_integrity.feature_extractor import (
    FEATURE_NAMES,
    extract_features,
    extract_feature_vector,
)


def test_feature_extractor_empty_code():
    feats = extract_features("")
    assert len(feats) == 24
    for name in FEATURE_NAMES:
        assert name in feats
        assert feats[name] == 0.0

    vec = extract_feature_vector("")
    assert isinstance(vec, np.ndarray)
    assert vec.shape == (24,)
    assert np.all(vec == 0.0)


def test_feature_extractor_syntax_error():
    broken_code = "def broken(x:\n    if x > 10\nreturn"
    feats = extract_features(broken_code)
    assert len(feats) == 24
    for name in FEATURE_NAMES:
        assert name in feats
        assert not np.isnan(feats[name])
        assert not np.isinf(feats[name])

    # Syntax error fallback checks
    assert feats["f12_docstring_coverage"] == 0.0
    assert feats["f15_cyclomatic_complexity"] == 1.0


def test_feature_extractor_valid_code():
    code = '''"""Module docstring."""
from typing import List, Optional

def compute_totals(items: List[int], threshold: Optional[int] = None) -> int:
    """Computes total with threshold check."""
    # Step 1: Initialize accumulator
    total = 0
    for val in items:
        if threshold is not None and val > threshold:
            continue
        total += val
    return total

if __name__ == "__main__":
    res = compute_totals([1, 2, 3, 10], threshold=5)
    print(res)
'''
    feats = extract_features(code)
    assert len(feats) == 24
    for name in FEATURE_NAMES:
        assert name in feats
        assert not np.isnan(feats[name])
        assert not np.isinf(feats[name])

    # Check key indicators
    assert feats["f12_docstring_coverage"] == 1.0  # function has docstring
    assert feats["f14_max_nesting_depth"] >= 2     # nested inside for and if
    assert feats["f15_cyclomatic_complexity"] >= 2 # decision points
    assert feats["f17_type_hint_density"] > 0.0    # has type annotations
    assert feats["f07_comment_line_ratio"] > 0.0   # has comment
    assert feats["f20_halstead_vocabulary"] > 0.0  # operators/operands
    assert feats["f22_halstead_volume"] > 0.0


def test_feature_extractor_latency():
    sample_code = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
"""
    # Warmup
    _ = extract_features(sample_code)

    # Benchmark 10 iterations
    start = time.perf_counter()
    for _ in range(10):
        vec = extract_feature_vector(sample_code)
        assert vec.shape == (24,)
    elapsed = (time.perf_counter() - start) / 10.0

    # Ensure single extraction executes well within budget (< 15ms on CPU)
    assert elapsed < 0.015, f"Extraction too slow: {elapsed*1000:.2f}ms"
