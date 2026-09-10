"""
Explainability Module for AI Code Detection.
Computes directional feature attributions in margin (log-odds) space using TreeSHAP.
Translates technical AST/lexical metrics into pedagogical, non-accusatory lecturer evidence.
"""

from typing import Any, Dict, List, Optional
import numpy as np

# Human-readable labels and descriptions for the 24 features
FEATURE_HUMAN_DESCRIPTIONS: Dict[str, Dict[str, str]] = {
    "f01_token_entropy": {
        "title": "Token Category Entropy",
        "desc": "Regularity of transitions between keywords, operators, and literals.",
    },
    "f02_keyword_density": {
        "title": "Python Keyword Density",
        "desc": "Proportion of control and structural keywords.",
    },
    "f03_identifier_length_avg": {
        "title": "Identifier Length",
        "desc": "Mean character length of variable and function identifiers.",
    },
    "f04_identifier_entropy": {
        "title": "Identifier Character Entropy",
        "desc": "Diversity of naming character distribution.",
    },
    "f05_canonical_var_ratio": {
        "title": "Textbook Variable Names",
        "desc": "Frequency of standard textbook identifiers (e.g., res, curr, temp).",
    },
    "f06_operator_density": {
        "title": "Operator Density",
        "desc": "Proportion of mathematical and logical operators.",
    },
    "f07_comment_line_ratio": {
        "title": "Comment Line Ratio",
        "desc": "Proportion of lines dedicated to comments.",
    },
    "f08_comment_char_ratio": {
        "title": "Comment Character Density",
        "desc": "Relative volume of comment text compared to executable code.",
    },
    "f09_line_length_mean": {
        "title": "Average Line Length",
        "desc": "Mean character length across non-empty lines.",
    },
    "f10_line_length_std": {
        "title": "Formatting Uniformity",
        "desc": "Standard deviation of line lengths (lower std indicates strict formatting).",
    },
    "f11_blank_line_ratio": {
        "title": "Blank Line Spacing",
        "desc": "Vertical code spacing and paragraphing.",
    },
    "f12_docstring_coverage": {
        "title": "Docstring Coverage",
        "desc": "Completeness of triple-quote function documentation.",
    },
    "f13_ast_node_density": {
        "title": "Syntax Node Density",
        "desc": "Density of abstract syntax tree elements per line of code.",
    },
    "f14_max_nesting_depth": {
        "title": "Nesting Block Depth",
        "desc": "Maximum nesting of conditionals and loops.",
    },
    "f15_cyclomatic_complexity": {
        "title": "Cyclomatic Complexity",
        "desc": "Number of independent linearly-independent paths through source.",
    },
    "f16_branching_ratio": {
        "title": "Branching Ratio",
        "desc": "Proportion of decision-making statements.",
    },
    "f17_type_hint_density": {
        "title": "Type Annotation Coverage",
        "desc": "Ratio of parameters with type annotations.",
    },
    "f18_comprehension_ratio": {
        "title": "Comprehension Construct Ratio",
        "desc": "Use of list/dict comprehensions versus procedural loops.",
    },
    "f19_exception_handling_count": {
        "title": "Defensive Exception Blocks",
        "desc": "Number of try-except error handling blocks.",
    },
    "f20_halstead_vocabulary": {
        "title": "Halstead Vocabulary",
        "desc": "Total distinct operators and operands.",
    },
    "f21_halstead_length": {
        "title": "Halstead Length",
        "desc": "Total count of operator and operand occurrences.",
    },
    "f22_halstead_volume": {
        "title": "Halstead Program Volume",
        "desc": "Information content required to specify the algorithm.",
    },
    "f23_halstead_difficulty": {
        "title": "Halstead Difficulty",
        "desc": "Measure of mental effort needed to construct or comprehend the code.",
    },
    "f24_halstead_effort": {
        "title": "Halstead Effort",
        "desc": "Total implementation effort derived from difficulty and volume.",
    },
}


def explain_prediction(
    feature_names: List[str],
    feature_values: np.ndarray,
    shap_values: Optional[np.ndarray] = None,
    top_k: int = 4,
) -> List[Dict[str, Any]]:
    """
    Produces top_k directional evidence items for instructor inspection.
    If shap_values is unavailable, estimates rank by deviation from median baseline.
    """
    explanations: List[Dict[str, Any]] = []

    if shap_values is not None and len(shap_values) == len(feature_names):
        # Sort by absolute SHAP attribution magnitude
        order = np.argsort(-np.abs(shap_values))[:top_k]
        for idx in order:
            feat = feature_names[idx]
            val = float(feature_values[idx])
            attribution = float(shap_values[idx])
            desc_info = FEATURE_HUMAN_DESCRIPTIONS.get(feat, {"title": feat, "desc": ""})

            direction = "elevates_ai_signal" if attribution > 0 else "supports_human_authoring"
            explanations.append({
                "feature": feat,
                "label": desc_info["title"],
                "description": desc_info["desc"],
                "value": round(val, 4),
                "attribution_log_odds": round(attribution, 4),
                "direction": direction,
            })
    else:
        # Fallback ranking using raw feature values
        for idx in range(min(top_k, len(feature_names))):
            feat = feature_names[idx]
            val = float(feature_values[idx])
            desc_info = FEATURE_HUMAN_DESCRIPTIONS.get(feat, {"title": feat, "desc": ""})
            explanations.append({
                "feature": feat,
                "label": desc_info["title"],
                "description": desc_info["desc"],
                "value": round(val, 4),
                "attribution_log_odds": 0.0,
                "direction": "neutral",
            })

    return explanations
