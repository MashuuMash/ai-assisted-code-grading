"""
Model Training, GroupKFold Benchmarking & Calibration Pipeline.
Benchmarks M0 (Heuristic), M1 (Logistic Regression), M2 (Random Forest), M3 (LightGBM).
Enforces zero-leakage GroupKFold grouped strictly by problem_id.
Calibrates probabilities and serializes production artifact to backend/app/ai_integrity/artifacts/.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import lightgbm as lgb
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.ai_integrity.feature_extractor import FEATURE_NAMES


def compute_pauc(y_true: np.ndarray, y_scores: np.ndarray, max_fpr: float = 0.05) -> float:
    """Computes partial AUROC restricted to low-FPR region (FPR <= max_fpr)."""
    try:
        return float(roc_auc_score(y_true, y_scores, max_fpr=max_fpr))
    except Exception:
        return 0.5


def run_heuristic_baseline(X: np.ndarray) -> np.ndarray:
    """
    Simulates the existing rule heuristic using the extracted surface features.
    Indices:
    f07: comment_line_ratio (idx 6)
    f12: docstring_coverage (idx 11)
    f17: type_hint_density (idx 16)
    """
    scores = []
    for row in X:
        pts = 0.0
        # Comment step patterns & ratio proxy
        if row[6] > 0.25:
            pts += 0.25
        # Docstring coverage
        if row[11] >= 0.99:
            pts += 0.20
        # Type hints
        if row[16] > 0.30:
            pts += 0.20
        # Line regularity
        if row[9] < 15.0 and row[8] > 20.0:  # low std, uniform length
            pts += 0.15
        score = min(0.95, max(0.05, pts))
        scores.append(score)
    return np.array(scores)


def evaluate_models(features_path: Path, artifacts_dir: Path):
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    records = []
    with open(features_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    X = np.array([r["features"] for r in records], dtype=np.float64)
    y = np.array([r["label"] for r in records], dtype=np.int32)
    groups = np.array([r["problem_id"] for r in records])

    unique_problems = len(set(groups))
    print(f"[*] Loaded {len(X)} samples across {unique_problems} distinct problem groups.")
    print(f"[*] Human samples: {np.sum(y == 0)}, Synthetic samples: {np.sum(y == 1)}")

    # 5-fold GroupKFold
    n_splits = 5
    gkf = GroupKFold(n_splits=n_splits)

    model_defs = {
        "M0_Heuristic_Baseline": None,
        "M1_Logistic_Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=500, random_state=42)),
        ]),
        "M2_Random_Forest": RandomForestClassifier(
            n_estimators=100, max_depth=6, random_state=42, n_jobs=-1
        ),
        "M3_LightGBM": lgb.LGBMClassifier(
            n_estimators=100, max_depth=5, learning_rate=0.05,
            random_state=42, verbose=-1
        ),
    }

    results = {name: {"auroc": [], "pauc_05": [], "brier": [], "fpr": [], "f1": []} for name in model_defs}

    for fold_idx, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups)):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        for name, model in model_defs.items():
            if name == "M0_Heuristic_Baseline":
                y_pred_proba = run_heuristic_baseline(X_test)
            else:
                model.fit(X_train, y_train)
                y_pred_proba = model.predict_proba(X_test)[:, 1]

            # Metrics
            auroc = roc_auc_score(y_test, y_pred_proba)
            pauc = compute_pauc(y_test, y_pred_proba, max_fpr=0.05)
            brier = brier_score_loss(y_test, y_pred_proba)

            # Operating threshold tau = 0.65
            y_pred_binary = (y_pred_proba >= 0.65).astype(int)
            neg_mask = (y_test == 0)
            fpr = np.mean(y_pred_binary[neg_mask] == 1) if np.sum(neg_mask) > 0 else 0.0
            f1 = f1_score(y_test, y_pred_binary, zero_division=0)

            results[name]["auroc"].append(auroc)
            results[name]["pauc_05"].append(pauc)
            results[name]["brier"].append(brier)
            results[name]["fpr"].append(fpr)
            results[name]["f1"].append(f1)

    # Print Comparative Benchmark Table
    print("\n" + "=" * 80)
    print("COMPARATIVE MODEL BENCHMARK RESULTS (5-Fold GroupKFold Zero-Leakage)")
    print("=" * 80)
    header = f"{'Model':<25} | {'AUROC':<10} | {'pAUC (<=0.05)':<14} | {'Brier':<10} | {'FPR @ 0.65':<12} | {'F1 @ 0.65':<10}"
    print(header)
    print("-" * len(header))

    for name in model_defs:
        m_auroc = np.mean(results[name]["auroc"])
        m_pauc = np.mean(results[name]["pauc_05"])
        m_brier = np.mean(results[name]["brier"])
        m_fpr = np.mean(results[name]["fpr"])
        m_f1 = np.mean(results[name]["f1"])
        print(f"{name:<25} | {m_auroc:<10.4f} | {m_pauc:<14.4f} | {m_brier:<10.4f} | {m_fpr:<12.4f} | {m_f1:<10.4f}")
    print("=" * 80 + "\n")

    # Train final calibrated production model on full Stage A corpus
    print("[*] Fitting final production model (M3 LightGBM) with 5-fold probability calibration...")
    base_lgb = lgb.LGBMClassifier(
        n_estimators=120, max_depth=5, learning_rate=0.04,
        random_state=42, verbose=-1
    )
    calibrated_clf = CalibratedClassifierCV(estimator=base_lgb, method="sigmoid", cv=5)
    calibrated_clf.fit(X, y)

    # Export model artifact
    model_artifact_path = artifacts_dir / "model_v1.joblib"
    joblib.dump(calibrated_clf, model_artifact_path)
    print(f"[+] Saved calibrated model artifact to: {model_artifact_path}")

    # Export feature metadata
    metadata = {
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
        "calibration_method": "sigmoid_platt",
        "cv_folds": 5,
        "operating_threshold": 0.65,
        "inconclusive_lower": 0.35,
        "inconclusive_upper": 0.65,
        "training_samples": len(X),
        "problem_groups": unique_problems,
    }
    meta_path = artifacts_dir / "features_v1.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"[+] Saved feature metadata to: {meta_path}")


def main():
    parser = argparse.ArgumentParser(description="Train and benchmark candidate AI detectors.")
    parser.add_argument("--features", type=str, default="data/processed/features_stage_a.jsonl")
    parser.add_argument("--artifacts", type=str, default="backend/app/ai_integrity/artifacts")
    args = parser.parse_args()

    evaluate_models(Path(args.features), Path(args.artifacts))


if __name__ == "__main__":
    main()
