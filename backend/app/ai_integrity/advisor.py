import json
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.models import ConfidenceTier, ExecutionResult, QualityMetric

def generate_grounded_feedback(
    student_code: str,
    assignment_title: str,
    execution_result: Optional[ExecutionResult],
    quality_metric: Optional[QualityMetric],
) -> Dict[str, Any]:
    """
    Generates pedagogically constructive, evidence-grounded feedback based strictly
    on dynamic test assertions and AST/Ruff static analysis.
    Uses LLM API if key configured, otherwise generates high-quality deterministic draft.
    """
    failed_tests = []
    if execution_result and execution_result.test_details:
        for t in execution_result.test_details:
            if t.get("status") in ("FAILED", "ERROR"):
                failed_tests.append(f"- {t.get('name')}: {t.get('message')}")

    ruff_issues = []
    if quality_metric and quality_metric.ruff_violations:
        for v in quality_metric.ruff_violations[:5]:
            ruff_issues.append(f"- Line {v.get('location', {}).get('row')}: [{v.get('code')}] {v.get('message')}")

    complexity_warning = None
    if quality_metric and quality_metric.cyclomatic_complexity_max > 10:
        complexity_warning = f"High cyclomatic complexity detected (Max: {quality_metric.cyclomatic_complexity_max}). Consider breaking nested logic into smaller functions."

    # If OpenAI API key is configured, call LLM
    if settings.OPENAI_API_KEY:
        try:
            return _call_openai_feedback(
                student_code=student_code,
                assignment_title=assignment_title,
                failed_tests=failed_tests,
                ruff_issues=ruff_issues,
                complexity_warning=complexity_warning,
            )
        except Exception:
            pass  # Fall back to deterministic draft

    # Deterministic evidence-grounded synthesis
    strengths = []
    weaknesses = []
    remediations = []

    if execution_result:
        if execution_result.passed_count > 0:
            strengths.append(f"Successfully passed {execution_result.passed_count} of {execution_result.total_count} test assertions.")
        if failed_tests:
            weaknesses.append(f"Failed {len(failed_tests)} test case(s). Review edge cases and expected return formats.")
            for ft in failed_tests[:3]:
                remediations.append(f"Examine test failure: {ft}")
        else:
            strengths.append("All automated functional test cases passed cleanly.")

    if quality_metric:
        if quality_metric.banned_imports_found:
            weaknesses.append(f"Disallowed module imports detected: {', '.join(quality_metric.banned_imports_found)}.")
            remediations.append("Remove banned module imports and implement algorithms using allowed language constructs.")
        if ruff_issues:
            weaknesses.append(f"Identified {len(quality_metric.ruff_violations)} style/lint warning(s).")
            for ri in ruff_issues[:3]:
                remediations.append(ri)
        else:
            strengths.append("Code adheres well to PEP 8 style standards with zero linter errors.")

        if complexity_warning:
            weaknesses.append(complexity_warning)
            remediations.append("Refactor deeply nested branching or loops into modular helper routines.")

    if not weaknesses:
        summary = f"Excellent submission for '{assignment_title}'. Solution passes all test suites and meets quality guidelines."
    else:
        summary = f"Submission for '{assignment_title}' requires revisions. Review the {len(weaknesses)} highlighted area(s) below."

    return {
        "summary": summary,
        "strengths": strengths or ["Code executed in testing harness."],
        "weaknesses": weaknesses or ["No significant architectural issues observed."],
        "remediation_steps": remediations or ["Maintain current coding conventions."],
        "model_identifier": "deterministic-evidence-rule-engine-v1",
    }


def analyze_ai_heuristics(source_code: str) -> Dict[str, Any]:
    """
    Calculates heuristic indicators for AI-generated Python code:
    - Overly uniform, step-by-step explanatory comment patterns
    - Disproportionate docstring and typing density
    - Textbook idiom patterns
    Returns probability_score, confidence_tier, indicators, and disclaimer.
    """
    indicators = {}
    heuristic_points = 0.0

    lines = [line.strip() for line in source_code.splitlines() if line.strip()]
    if not lines:
        return {
            "probability_score": Decimal("0.0000"),
            "confidence_tier": ConfidenceTier.LOW,
            "indicators": {"reason": "Empty submission"},
            "disclaimer": "AI detection signals are probabilistic heuristics and require lecturer verification.",
        }

    comment_lines = [line for line in lines if line.startswith("#")]
    comment_ratio = len(comment_lines) / max(1, len(lines))
    indicators["comment_ratio"] = round(comment_ratio, 3)

    # 1. Step-by-step LLM comment markers
    step_patterns = [
        r"^#\s*Step\s*\d+",
        r"^#\s*Helper function",
        r"^#\s*Initialize\s+",
        r"^#\s*Base case",
        r"^#\s*Recursive case",
        r"^#\s*Return the result",
    ]
    step_matches = sum(1 for line in comment_lines if any(re.search(pat, line, re.IGNORECASE) for pat in step_patterns))
    if step_matches >= 3:
        heuristic_points += 0.35
        indicators["structured_step_comments"] = step_matches

    # 2. Advanced type annotations in simple code
    type_hints = len(re.findall(r":\s*(int|str|float|bool|List|Dict|Tuple|Optional|Any)\b", source_code))
    if type_hints >= 5:
        heuristic_points += 0.20
        indicators["comprehensive_type_hints"] = type_hints

    # 3. Clean docstring coverage on every function
    docstrings = len(re.findall(r'"""[\s\S]*?"""', source_code))
    func_count = len(re.findall(r"\bdef\s+\w+\(", source_code))
    if func_count > 0 and docstrings >= func_count:
        heuristic_points += 0.20
        indicators["complete_docstring_coverage"] = True

    # 4. Standard boilerplate idioms
    if 'if __name__ == "__main__":' in source_code and 'pass' not in source_code:
        heuristic_points += 0.10

    prob = min(0.95, max(0.05, heuristic_points))
    prob_dec = Decimal(str(round(prob, 4)))

    if prob >= 0.70:
        tier = ConfidenceTier.HIGH
    elif prob >= 0.45:
        tier = ConfidenceTier.MEDIUM
    else:
        tier = ConfidenceTier.LOW

    return {
        "probability_score": prob_dec,
        "confidence_tier": tier,
        "indicators": indicators,
        "disclaimer": (
            "Heuristic indicator only. False positives are common on introductory assignments. "
            "Do not penalize without oral defense or corroborating evidence."
        ),
    }


def _call_openai_feedback(
    student_code: str,
    assignment_title: str,
    failed_tests: List[str],
    ruff_issues: List[str],
    complexity_warning: Optional[str],
) -> Dict[str, Any]:
    prompt = f"""
You are an academic programming instructor evaluating a Python student submission for '{assignment_title}'.
Produce structured JSON feedback with keys: 'summary', 'strengths' (list), 'weaknesses' (list), 'remediation_steps' (list).

Ground your response strictly in the following evidence:
FAILED TESTS:
{chr(10).join(failed_tests) if failed_tests else 'None (All tests passed)'}

LINT WARNINGS:
{chr(10).join(ruff_issues) if ruff_issues else 'None'}

AST NOTES:
{complexity_warning or 'None'}

STUDENT CODE:
{student_code[:1500]}
"""

    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful Python professor providing strict evidence-based grading feedback."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    with httpx.Client(timeout=15.0) as client:
        resp = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        content = json.loads(data["choices"][0]["message"]["content"])
        content["model_identifier"] = "gpt-4o-mini"
        return content
