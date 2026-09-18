from app.static_analysis import StaticAnalyzer, run_ruff_linter


def test_ruff_linter_finds_unused_import():
    code = """import os
import sys

def hello():
    return "world"
"""
    issues = run_ruff_linter(code)
    # Ruff should flag F401: os imported but unused, sys imported but unused
    f401_issues = [i for i in issues if i.code == "F401"]
    assert len(f401_issues) >= 1
    assert any("os" in i.message for i in f401_issues)


def test_static_analyzer_clean_code():
    code = """def multiply(a: int, b: int) -> int:
    return a * b
"""
    analyzer = StaticAnalyzer()
    report = analyzer.analyze_source(code)
    assert report.is_valid_python is True
    assert len(report.ruff_issues) == 0
    assert report.ast_result.function_count == 1
    assert len(report.ast_result.issues) == 0
    assert report.total_issues_count == 0


def test_static_analyzer_to_dict():
    code = """import math

def circle_area(r):
    return math.pi * r * r
"""
    analyzer = StaticAnalyzer()
    report = analyzer.analyze_source(code)
    data = report.to_dict()
    assert "is_valid_python" in data
    assert "ruff_issues" in data
    assert "ast_result" in data
    assert data["ast_result"]["function_count"] == 1
