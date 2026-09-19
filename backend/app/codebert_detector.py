import ast
import math
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

from app.models import (
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    SubmissionEvidence,
)

# Optional PyTorch & Hugging Face Transformers integration
try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    torch = None  # type: ignore
    AutoTokenizer = None  # type: ignore
    AutoModelForSequenceClassification = None  # type: ignore
    TRANSFORMERS_AVAILABLE = False


@dataclass
class CodeBertPrediction:
    ai_probability: float
    classification: str
    confidence_score: float
    model_mode: str
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CodeBertDetector:
    """Experimental AI-generated-code detector using Microsoft CodeBERT with fallback heuristic."""

    def __init__(self, model_name_or_path: str = "microsoft/codebert-base") -> None:
        self.model_name = model_name_or_path
        self._model = None
        self._tokenizer = None
        self.is_transformers_loaded = False

    def _init_transformers_model(self) -> bool:
        if not TRANSFORMERS_AVAILABLE or self._model is not None:
            return self.is_transformers_loaded

        try:
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name, num_labels=2
            )
            self._model.eval()
            self.is_transformers_loaded = True
        except Exception:
            self.is_transformers_loaded = False

        return self.is_transformers_loaded

    def predict(self, source_code: str) -> CodeBertPrediction:
        if not source_code or not source_code.strip():
            return CodeBertPrediction(
                ai_probability=0.0,
                classification="human",
                confidence_score=1.0,
                model_mode="empty_source",
                signals=["Empty source code"],
            )

        if TRANSFORMERS_AVAILABLE and self._init_transformers_model():
            return self._predict_with_transformers(source_code)

        return self._predict_with_heuristic(source_code)

    def _predict_with_transformers(self, source_code: str) -> CodeBertPrediction:
        try:
            inputs = self._tokenizer(
                source_code,
                max_length=512,
                padding=True,
                truncation=True,
                return_tensors="pt",
            )
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = torch.softmax(outputs.logits, dim=1).squeeze().tolist()

            ai_prob = float(probs[1]) if isinstance(probs, list) and len(probs) > 1 else 0.5
            ai_prob = round(max(0.0, min(1.0, ai_prob)), 4)
            confidence = round(abs(ai_prob - 0.5) * 2.0, 4)

            classification = (
                "ai_generated" if ai_prob >= 0.65 else "human" if ai_prob <= 0.35 else "inconclusive"
            )

            signals = [
                f"CodeBERT sequence classification probability: {round(ai_prob * 100.0, 1)}%",
                f"Prediction confidence level: {round(confidence * 100.0, 1)}%",
            ]

            return CodeBertPrediction(
                ai_probability=ai_prob,
                classification=classification,
                confidence_score=confidence,
                model_mode="transformers_codebert",
                signals=signals,
            )
        except Exception:
            # Graceful fallback if inference encounters unexpected runtime failure
            return self._predict_with_heuristic(source_code)

    def _predict_with_heuristic(self, source_code: str) -> CodeBertPrediction:
        """Statistical and AST stylometry analyzer estimating AI generation likelihood."""
        signals: list[str] = []
        score_components: list[float] = []

        lines = [line.strip() for line in source_code.splitlines() if line.strip()]
        total_lines = len(lines)

        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            return CodeBertPrediction(
                ai_probability=0.15,
                classification="human",
                confidence_score=0.70,
                model_mode="heuristic_statistical",
                signals=["Syntax error present; typical of human exploratory editing"],
            )

        # 1. Docstring & Comment structure analysis
        has_module_docstring = bool(ast.get_docstring(tree))
        func_docstrings = 0
        total_funcs = 0
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                total_funcs += 1
                if ast.get_docstring(node):
                    func_docstrings += 1

        if has_module_docstring or (total_funcs > 0 and func_docstrings == total_funcs):
            score_components.append(0.75)
            signals.append("Comprehensive standardized docstring structure")
        else:
            score_components.append(0.30)

        # 2. Identifier Naming Consistency (snake_case vs CamelCase uniformity)
        names: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                names.append(node.id)
            elif isinstance(node, ast.FunctionDef):
                names.append(node.name)

        if names:
            is_snake = [name.islower() and not name.startswith("__") for name in names]
            snake_ratio = sum(is_snake) / len(names)
            if snake_ratio > 0.85:
                score_components.append(0.70)
                signals.append(f"Highly uniform naming convention ({round(snake_ratio * 100, 1)}% consistent)")
            else:
                score_components.append(0.35)

            # 3. Token Lexical Entropy
            name_counts: dict[str, int] = {}
            for name in names:
                name_counts[name] = name_counts.get(name, 0) + 1
            total_n = len(names)
            entropy = -sum((c / total_n) * math.log2(c / total_n) for c in name_counts.values())

            # Balanced entropy is common in LLM generation (not too repetitive, not overly chaotic)
            if 2.0 <= entropy <= 4.5:
                score_components.append(0.65)
                signals.append(f"Lexical distribution entropy within typical AI profile ({round(entropy, 2)})")
            else:
                score_components.append(0.40)

        # 4. Control-flow idioms (clean, linear control structures)
        loop_count = sum(1 for node in ast.walk(tree) if isinstance(node, (ast.For, ast.While)))
        branch_count = sum(1 for node in ast.walk(tree) if isinstance(node, ast.If))
        if total_lines > 5 and (loop_count + branch_count) > 0:
            ratio = (loop_count + branch_count) / total_lines
            if 0.10 <= ratio <= 0.35:
                score_components.append(0.65)
                signals.append("Balanced branch-to-line ratio characteristic of generated code")

        # Average probability from components
        ai_prob = sum(score_components) / len(score_components) if score_components else 0.5
        ai_prob = round(max(0.05, min(0.95, ai_prob)), 4)
        confidence = round(abs(ai_prob - 0.5) * 2.0, 4)

        classification = (
            "ai_generated" if ai_prob >= 0.65 else "human" if ai_prob <= 0.35 else "inconclusive"
        )

        return CodeBertPrediction(
            ai_probability=ai_prob,
            classification=classification,
            confidence_score=confidence,
            model_mode="heuristic_statistical",
            signals=signals,
        )


def generate_codebert_evidence(
    submission_id: int,
    assignment_id: int,
    prediction: CodeBertPrediction,
) -> list[SubmissionEvidence]:
    """Transform a CodeBertPrediction into a normalized SubmissionEvidence record."""
    pct = round(prediction.ai_probability * 100.0, 1)

    if prediction.ai_probability >= 0.65:
        severity = EvidenceSeverity.WARNING
        rule_code = "AI_CODE_PROBABILITY_HIGH"
        message = (
            f"CodeBERT detected elevated likelihood of AI-generated source code ({pct}%). "
            f"Classification: {prediction.classification}. "
            f"Top signal: {prediction.signals[0] if prediction.signals else 'Consistent stylometric profile'}"
        )
    elif prediction.ai_probability <= 0.35:
        severity = EvidenceSeverity.INFO
        rule_code = "AI_CODE_PROBABILITY_LOW"
        message = (
            f"CodeBERT detected low likelihood of AI-generated source code ({pct}%). "
            f"Classification: {prediction.classification}."
        )
    else:
        severity = EvidenceSeverity.INFO
        rule_code = "AI_CODE_PROBABILITY_INCONCLUSIVE"
        message = (
            f"CodeBERT AI code detection was inconclusive ({pct}%). "
            "Manual review recommended if academic integrity verification is required."
        )

    evidence_item = SubmissionEvidence(
        id=f"ev-codebert-{uuid.uuid4().hex[:12]}",
        submission_id=submission_id,
        assignment_id=assignment_id,
        source=EvidenceSource.CODEBERT,
        category=EvidenceCategory.SIMILARITY,
        severity=severity,
        rule_code=rule_code,
        message=message,
        metric_value=prediction.ai_probability,
        raw_data={
            "classification": prediction.classification,
            "confidence_score": prediction.confidence_score,
            "model_mode": prediction.model_mode,
            "signals": prediction.signals,
        },
    )

    return [evidence_item]
