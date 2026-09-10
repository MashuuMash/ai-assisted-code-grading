from decimal import Decimal
import numpy as np
import pytest

from app.ai_integrity.detector import AIDetectionService, get_ai_detection_service
from app.ai_integrity.explainer import FEATURE_HUMAN_DESCRIPTIONS, explain_prediction
from app.models import ConfidenceTier


def test_detector_singleton():
    svc1 = get_ai_detection_service()
    svc2 = get_ai_detection_service()
    assert svc1 is svc2
    assert svc1.model is not None


def test_detector_empty_submission():
    svc = get_ai_detection_service()
    res = svc.predict("")
    assert res["probability_score"] == Decimal("0.0000")
    assert res["confidence_tier"] == ConfidenceTier.LOW
    assert "disclaimer" in res


def test_detector_inference_bounds_and_structure():
    svc = get_ai_detection_service()
    code = '''def is_prime(n: int) -> bool:
    """Checks whether n is prime."""
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True
'''
    res = svc.predict(code)
    prob = res["probability_score"]
    assert isinstance(prob, Decimal)
    assert Decimal("0.0000") <= prob <= Decimal("1.0000")
    assert res["confidence_tier"] in (ConfidenceTier.LOW, ConfidenceTier.MEDIUM, ConfidenceTier.HIGH)
    assert "indicators" in res
    indicators = res["indicators"]
    assert "top_features" in indicators
    assert len(indicators["top_features"]) <= 4
    for feat in indicators["top_features"]:
        assert "feature" in feat
        assert "label" in feat
        assert "attribution_log_odds" in feat
        assert feat["direction"] in ("elevates_ai_signal", "supports_human_authoring", "neutral")


def test_explainer_formatting():
    feature_names = ["f01_token_entropy", "f10_line_length_std", "f12_docstring_coverage"]
    feature_vals = np.array([3.45, 12.5, 1.0])
    shap_vals = np.array([0.45, -0.80, 0.12])

    explanations = explain_prediction(feature_names, feature_vals, shap_values=shap_vals, top_k=2)
    assert len(explanations) == 2
    # First should be the largest absolute SHAP value (f10_line_length_std with abs 0.80)
    assert explanations[0]["feature"] == "f10_line_length_std"
    assert explanations[0]["direction"] == "supports_human_authoring"
    assert explanations[0]["attribution_log_odds"] == -0.80

    # Second should be f01_token_entropy (abs 0.45)
    assert explanations[1]["feature"] == "f01_token_entropy"
    assert explanations[1]["direction"] == "elevates_ai_signal"
    assert explanations[1]["attribution_log_odds"] == 0.45
