"""
ML Inference Service for AI-Generated Code Detection.
Loads calibrated LightGBM model artifact, extracts 24D features,
computes TreeSHAP log-odds explanations, and maps to ConfidenceTier.
Gracefully falls back to heuristic regex advisor if artifacts are absent.
"""

import json
import logging
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import shap

from app.ai_integrity.advisor import analyze_ai_heuristics
from app.ai_integrity.explainer import explain_prediction
from app.ai_integrity.feature_extractor import FEATURE_NAMES, extract_feature_vector
from app.models import ConfidenceTier

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model_v1.joblib"
METADATA_PATH = ARTIFACTS_DIR / "features_v1.json"


class AIDetectionService:
    _instance: Optional["AIDetectionService"] = None

    def __init__(self) -> None:
        self.model: Any = None
        self.metadata: Dict[str, Any] = {}
        self.tree_explainer: Optional[shap.TreeExplainer] = None
        self._load_artifacts()

    @classmethod
    def get_instance(cls) -> "AIDetectionService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_artifacts(self) -> None:
        if not MODEL_PATH.exists() or not METADATA_PATH.exists():
            logger.warning(
                "AI detection model artifacts not found at %s. Falling back to heuristic baseline.",
                ARTIFACTS_DIR,
            )
            return

        try:
            self.model = joblib.load(MODEL_PATH)
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

            # Initialize TreeSHAP explainer on base estimator if available
            base_estimator = None
            if hasattr(self.model, "calibrated_classifiers_") and self.model.calibrated_classifiers_:
                base_estimator = self.model.calibrated_classifiers_[0].estimator
            elif hasattr(self.model, "estimator"):
                base_estimator = self.model.estimator
            else:
                base_estimator = self.model

            if base_estimator is not None:
                self.tree_explainer = shap.TreeExplainer(base_estimator)

            logger.info("Successfully loaded calibrated AI detection model v1.")
        except Exception as e:
            logger.error("Failed to load AI detection artifacts: %s. Using heuristic fallback.", e)
            self.model = None

    def predict(self, source_code: str) -> Dict[str, Any]:
        """
        Infers probability of AI generation on Python source code.
        Returns dictionary formatted for AIDetectionSignal database model.
        """
        # Fallback to existing heuristic detector if model failed to load
        if self.model is None:
            return analyze_ai_heuristics(source_code)

        if not source_code or not source_code.strip():
            return {
                "probability_score": Decimal("0.0000"),
                "confidence_tier": ConfidenceTier.LOW,
                "indicators": {
                    "reason": "Empty submission",
                    "model_version": "v1.0-calibrated",
                },
                "disclaimer": (
                    "AI detection scores represent statistical style signals, not definitive proof of "
                    "academic misconduct. The lecturer retains sole academic authority."
                ),
            }

        # 1. Extract 24-dimensional feature vector
        feat_vec = extract_feature_vector(source_code)
        X = feat_vec.reshape(1, -1)

        # 2. Calibrated inference
        try:
            proba = float(self.model.predict_proba(X)[0, 1])
        except Exception as e:
            logger.error("Inference exception: %s. Falling back to heuristics.", e)
            return analyze_ai_heuristics(source_code)

        proba = max(0.0, min(1.0, proba))
        proba_dec = Decimal(str(round(proba, 4)))

        # 3. TreeSHAP feature attributions
        shap_row = None
        if self.tree_explainer is not None:
            try:
                raw_shap = self.tree_explainer.shap_values(X)
                if isinstance(raw_shap, list):
                    shap_row = raw_shap[1][0]
                elif hasattr(raw_shap, "ndim") and raw_shap.ndim == 3:
                    shap_row = raw_shap[0, :, 1]
                else:
                    shap_row = raw_shap[0]
            except Exception as e:
                logger.debug("TreeSHAP calculation bypassed: %s", e)
                shap_row = None

        top_evidence = explain_prediction(
            FEATURE_NAMES,
            feat_vec,
            shap_values=shap_row,
            top_k=4,
        )

        # 4. Multi-tier classification
        # HIGH: >= 0.70 (Elevated AI Style Indicators)
        # MEDIUM: 0.35 <= proba < 0.70 (Mixed / Inconclusive Signal)
        # LOW: < 0.35 (Consistent with Student Authoring)
        if proba >= 0.70:
            tier = ConfidenceTier.HIGH
            badge_label = "Elevated AI Style Indicators"
        elif proba >= 0.35:
            tier = ConfidenceTier.MEDIUM
            badge_label = "Mixed / Inconclusive Signal"
        else:
            tier = ConfidenceTier.LOW
            badge_label = "Consistent with Student Authoring"

        indicators = {
            "model_version": "v1.0-calibrated-lgb",
            "calibration": "sigmoid_platt",
            "badge_label": badge_label,
            "top_features": top_evidence,
            "raw_features": {name: round(float(val), 4) for name, val in zip(FEATURE_NAMES, feat_vec)},
        }

        return {
            "probability_score": proba_dec,
            "confidence_tier": tier,
            "indicators": indicators,
            "disclaimer": (
                "AI detection scores represent statistical style signals, not definitive proof of "
                "academic misconduct. Conscientious students using clean formatting and standard idioms "
                "may trigger intermediate indicators. The lecturer retains sole academic authority."
            ),
        }


def get_ai_detection_service() -> AIDetectionService:
    return AIDetectionService.get_instance()
