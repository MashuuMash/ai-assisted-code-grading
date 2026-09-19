import argparse
import json
import statistics
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.codebert_detector import CodeBertDetector

DATASET_FILE = Path(__file__).resolve().parent.parent / "data" / "ai_code_dataset" / "dataset.json"
RESULTS_FILE = Path(__file__).resolve().parent.parent / "docs" / "codebert_evaluation_results.json"


def evaluate_codebert_performance(dataset_path: Path) -> dict:
    with open(dataset_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    detector = CodeBertDetector()

    tp = 0
    fp = 0
    tn = 0
    fn = 0

    human_probs = []
    ai_probs = []

    model_breakdown: dict[str, list[float]] = {}
    perturbation_results = {"unperturbed_ai": [], "perturbed_ai": []}

    threshold = 0.50

    for sample in samples:
        code = sample["code"]
        true_label = sample["label"]  # 0: human, 1: ai
        source_type = sample.get("source_type", "unknown")

        prediction = detector.predict(code)
        prob = prediction.ai_probability

        pred_label = 1 if prob >= threshold else 0

        if true_label == 1:
            ai_probs.append(prob)
            if pred_label == 1:
                tp += 1
            else:
                fn += 1

            if source_type == "ai_perturbed":
                perturbation_results["perturbed_ai"].append(prob)
            else:
                perturbation_results["unperturbed_ai"].append(prob)
        else:
            human_probs.append(prob)
            if pred_label == 1:
                fp += 1
            else:
                tn += 1

        model_breakdown.setdefault(source_type, []).append(prob)

    total = len(samples)
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2.0 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    mean_human_prob = statistics.mean(human_probs) if human_probs else 0.0
    mean_ai_prob = statistics.mean(ai_probs) if ai_probs else 0.0

    unpert_mean = statistics.mean(perturbation_results["unperturbed_ai"]) if perturbation_results["unperturbed_ai"] else 0.0
    pert_mean = statistics.mean(perturbation_results["perturbed_ai"]) if perturbation_results["perturbed_ai"] else 0.0
    evasion_drop_pct = round((unpert_mean - pert_mean) * 100.0, 2)

    breakdown_summary = {}
    for st, probs in model_breakdown.items():
        breakdown_summary[st] = {
            "count": len(probs),
            "mean_ai_probability": round(statistics.mean(probs), 4),
            "detection_rate_pct": round((sum(1 for p in probs if p >= threshold) / len(probs)) * 100.0, 1),
        }

    results = {
        "dataset_sample_count": total,
        "classification_metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "confusion_matrix": {
                "true_positives": tp,
                "false_positives": fp,
                "true_negatives": tn,
                "false_negatives": fn,
            },
        },
        "score_distribution": {
            "mean_human_probability": round(mean_human_prob, 4),
            "mean_ai_probability": round(mean_ai_prob, 4),
            "separation_margin": round(mean_ai_prob - mean_human_prob, 4),
        },
        "rq5_cross_model_breakdown": breakdown_summary,
        "rq5_evasion_robustness": {
            "unperturbed_ai_mean_prob": round(unpert_mean, 4),
            "perturbed_ai_mean_prob": round(pert_mean, 4),
            "evasion_drop_percentage_points": evasion_drop_pct,
        },
    }

    return results


def print_evaluation_report(results: dict):
    print("=" * 78)
    print("CodeBERT AI-Generated Code Detection - Research Evaluation (RQ5)")
    print("=" * 78)

    metrics = results["classification_metrics"]
    cm = metrics["confusion_matrix"]

    print("\n[1] Overall Classification Performance:")
    print(f"  - Accuracy:  {round(metrics['accuracy'] * 100, 2)}%")
    print(f"  - Precision: {round(metrics['precision'] * 100, 2)}%")
    print(f"  - Recall:    {round(metrics['recall'] * 100, 2)}%")
    print(f"  - F1-Score:  {round(metrics['f1_score'] * 100, 2)}%")
    print("  - Confusion Matrix:")
    print(f"      True Positives (AI as AI):     {cm['true_positives']}")
    print(f"      False Positives (Human as AI):  {cm['false_positives']}")
    print(f"      True Negatives (Human as Human):{cm['true_negatives']}")
    print(f"      False Negatives (AI as Human):  {cm['false_negatives']}")

    dist = results["score_distribution"]
    print("\n[2] Separation Margin:")
    print(f"  - Mean Human AI-Probability: {round(dist['mean_human_probability'] * 100, 1)}%")
    print(f"  - Mean AI-Generated Prob:    {round(dist['mean_ai_probability'] * 100, 1)}%")
    print(f"  - Margin of Separation:      {round(dist['separation_margin'] * 100, 1)} percentage points")

    print("\n[3] RQ5 Cross-Model & Prompt Breakdown:")
    for src, data in results["rq5_cross_model_breakdown"].items():
        print(f"  - {src:18} | Count: {data['count']:2} | Mean P(AI): {round(data['mean_ai_probability'] * 100, 1):5}% | Detected: {data['detection_rate_pct']}%")

    evasion = results["rq5_evasion_robustness"]
    print("\n[4] RQ5 Evasion & Refactoring Robustness:")
    print(f"  - Clean AI Code Mean P(AI):     {round(evasion['unperturbed_ai_mean_prob'] * 100, 1)}%")
    print(f"  - Refactored AI Code Mean P(AI):{round(evasion['perturbed_ai_mean_prob'] * 100, 1)}%")
    print(f"  - Detection Drop:               {evasion['evasion_drop_percentage_points']} percentage points")
    print("  - Research Finding: Identifies why AI detectors serve as supporting signals rather than final proof.")

    print("\n" + "=" * 78)


def main():
    parser = argparse.ArgumentParser(description="Evaluate CodeBERT AI code detector performance")
    parser.add_argument("--dataset", type=str, default=str(DATASET_FILE), help="Path to dataset JSON")
    parser.add_argument("--output", type=str, default=str(RESULTS_FILE), help="Path to save output JSON")
    args = parser.parse_args()

    ds_path = Path(args.dataset)
    if not ds_path.exists():
        print(f"Dataset not found at {ds_path}. Generating dataset first...")
        from generate_ai_code_dataset import build_synthetic_research_dataset
        ds_path.parent.mkdir(parents=True, exist_ok=True)
        ds = build_synthetic_research_dataset()
        with open(ds_path, "w", encoding="utf-8") as f:
            json.dump(ds, f, indent=2)

    results = evaluate_codebert_performance(ds_path)
    print_evaluation_report(results)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to: {out_path.resolve()}")


if __name__ == "__main__":
    main()
