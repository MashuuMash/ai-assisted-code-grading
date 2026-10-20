"""Dependency-free threshold and abstention reports; not authorship probabilities."""

import math


def wilson_upper(errors, total, z=1.96):
    if not total:
        return None
    p = errors / total
    return (
        p
        + z * z / (2 * total)
        + z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total))
    ) / (1 + z * z / total)


def binary_metrics(labels, scores, threshold=0.5):
    if len(labels) != len(scores) or not labels or set(labels) != {0, 1}:
        raise ValueError("Expected equal nonempty arrays containing both labels")
    if any(not math.isfinite(float(p)) or not 0 <= p <= 1 for p in scores):
        raise ValueError("Scores must be finite and in [0,1]")
    tn = fp = fn = tp = 0
    for y, p in zip(labels, scores):
        if y == 0:
            fp += p >= threshold
            tn += p < threshold
        else:
            tp += p >= threshold
            fn += p < threshold
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn)
    return {
        "threshold": threshold,
        "n": len(labels),
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "accuracy": (tn + tp) / len(labels),
        "precision_ai": precision,
        "recall_ai": recall,
        "f1_ai": 2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0,
        "human_false_positive_rate": fp / (tn + fp),
        "human_fpr_wilson95_upper": wilson_upper(fp, tn + fp),
    }


def select_threshold(labels, scores, max_fpr=0.01):
    # Include an explicit 'never flag' option; ties favor a higher threshold.
    candidates = sorted({0.0, 1.000001, *map(float, scores)})
    reports = [binary_metrics(labels, scores, t) for t in candidates]
    feasible = [m for m in reports if m["human_false_positive_rate"] <= max_fpr]
    return max(
        feasible,
        key=lambda m: (m["recall_ai"], -m["human_false_positive_rate"], m["threshold"]),
    )


def abstention_metrics(labels, scores, low=0.35, high=0.65):
    binary_metrics(labels, scores)  # Validate inputs.
    human_n = labels.count(0)
    ai_n = labels.count(1)
    inconclusive = sum(low < p < high for p in scores)
    return {
        "low": low,
        "high": high,
        "inconclusive_rate": inconclusive / len(labels),
        "human_flagged_ai_rate": sum(
            y == 0 and p >= high for y, p in zip(labels, scores)
        )
        / human_n,
        "ai_called_human_rate": sum(y == 1 and p <= low for y, p in zip(labels, scores))
        / ai_n,
    }
