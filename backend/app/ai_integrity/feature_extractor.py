import ast
import io
import math
import tokenize
from collections import Counter
from typing import Any, Dict, List, Set, Tuple

import numpy as np

# Canonical feature ordering (24 dimensions)
FEATURE_NAMES: List[str] = [
    "f01_token_entropy",
    "f02_keyword_density",
    "f03_identifier_length_avg",
    "f04_identifier_entropy",
    "f05_canonical_var_ratio",
    "f06_operator_density",
    "f07_comment_line_ratio",
    "f08_comment_char_ratio",
    "f09_line_length_mean",
    "f10_line_length_std",
    "f11_blank_line_ratio",
    "f12_docstring_coverage",
    "f13_ast_node_density",
    "f14_max_nesting_depth",
    "f15_cyclomatic_complexity",
    "f16_branching_ratio",
    "f17_type_hint_density",
    "f18_comprehension_ratio",
    "f19_exception_handling_count",
    "f20_halstead_vocabulary",
    "f21_halstead_length",
    "f22_halstead_volume",
    "f23_halstead_difficulty",
    "f24_halstead_effort",
]

# Common canonical / textbook variable names often found in standard algorithms
CANONICAL_VARS: Set[str] = {
    "res", "result", "ans", "answer", "curr", "current",
    "val", "value", "temp", "tmp", "dummy", "node", "head",
    "tail", "prev", "next", "idx", "index", "cnt", "count",
    "total", "acc", "sum", "diff", "max_val", "min_val",
}

PYTHON_KEYWORDS: Set[str] = {
    "False", "None", "True", "and", "as", "assert", "async", "await",
    "break", "class", "continue", "def", "del", "elif", "else",
    "except", "finally", "for", "from", "global", "if", "import",
    "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
    "return", "try", "while", "with", "yield",
}


def _shannon_entropy(counts: Counter) -> float:
    total = sum(counts.values())
    if total <= 0:
        return 0.0
    entropy = 0.0
    for count in counts.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return float(entropy)


def _extract_surface_and_lexical(source_code: str) -> Dict[str, float]:
    metrics: Dict[str, float] = {}

    lines = source_code.splitlines()
    total_lines = len(lines)
    non_empty_lines = [l for l in lines if l.strip()]
    num_non_empty = len(non_empty_lines)
    num_blank = total_lines - num_non_empty

    # Blank line ratio
    metrics["f11_blank_line_ratio"] = float(num_blank / max(1, total_lines))

    # Line lengths
    if num_non_empty > 0:
        line_lens = [len(l) for l in non_empty_lines]
        metrics["f09_line_length_mean"] = float(np.mean(line_lens))
        metrics["f10_line_length_std"] = float(np.std(line_lens))
    else:
        metrics["f09_line_length_mean"] = 0.0
        metrics["f10_line_length_std"] = 0.0

    # Token-level analysis using tokenize
    token_types: Counter = Counter()
    total_tokens = 0
    keyword_count = 0
    operator_count = 0
    identifiers: List[str] = []
    comment_lines_count = 0
    comment_chars_count = 0
    operators: List[str] = []
    operands: List[str] = []

    try:
        tokens = list(tokenize.tokenize(io.BytesIO(source_code.encode("utf-8")).readline))
    except Exception:
        tokens = []

    for tok in tokens:
        tok_type = tok.type
        tok_str = tok.string

        if tok_type in (tokenize.ENCODING, tokenize.ENDMARKER):
            continue

        token_types[tok_type] += 1
        total_tokens += 1

        if tok_type == tokenize.COMMENT:
            comment_lines_count += 1
            comment_chars_count += len(tok_str)
        elif tok_type == tokenize.NAME:
            if tok_str in PYTHON_KEYWORDS:
                keyword_count += 1
                operators.append(tok_str)
            else:
                identifiers.append(tok_str)
                operands.append(tok_str)
        elif tok_type == tokenize.OP:
            operator_count += 1
            operators.append(tok_str)
        elif tok_type == tokenize.NUMBER or tok_type == tokenize.STRING:
            operands.append(tok_str)

    # f01: token entropy
    metrics["f01_token_entropy"] = _shannon_entropy(token_types)

    # f02: keyword density
    metrics["f02_keyword_density"] = float(keyword_count / max(1, total_tokens))

    # f03 & f04: identifier average length and character entropy
    if identifiers:
        id_lens = [len(i) for i in identifiers]
        metrics["f03_identifier_length_avg"] = float(np.mean(id_lens))
        char_counts = Counter("".join(identifiers))
        metrics["f04_identifier_entropy"] = _shannon_entropy(char_counts)
        canonical_count = sum(1 for i in identifiers if i.lower() in CANONICAL_VARS)
        metrics["f05_canonical_var_ratio"] = float(canonical_count / len(identifiers))
    else:
        metrics["f03_identifier_length_avg"] = 0.0
        metrics["f04_identifier_entropy"] = 0.0
        metrics["f05_canonical_var_ratio"] = 0.0

    # f06: operator density
    metrics["f06_operator_density"] = float(operator_count / max(1, total_tokens))

    # f07 & f08: comment metrics
    total_chars = max(1, len(source_code))
    metrics["f07_comment_line_ratio"] = float(comment_lines_count / max(1, num_non_empty))
    metrics["f08_comment_char_ratio"] = float(comment_chars_count / total_chars)

    # Halstead Software Science metrics
    eta1 = len(set(operators))   # distinct operators
    eta2 = len(set(operands))    # distinct operands
    N1 = len(operators)          # total operators
    N2 = len(operands)           # total operands

    eta = eta1 + eta2
    N = N1 + N2

    metrics["f20_halstead_vocabulary"] = float(eta)
    metrics["f21_halstead_length"] = float(N)

    if eta > 1 and N > 0:
        volume = float(N * math.log2(eta))
    else:
        volume = 0.0
    metrics["f22_halstead_volume"] = volume

    if eta2 > 0:
        difficulty = float((eta1 / 2.0) * (N2 / eta2))
    else:
        difficulty = 0.0
    metrics["f23_halstead_difficulty"] = difficulty
    metrics["f24_halstead_effort"] = float(difficulty * volume)

    return metrics


class _ASTFeatureVisitor(ast.NodeVisitor):
    def __init__(self, total_lines: int) -> None:
        self.total_lines = max(1, total_lines)
        self.total_ast_nodes = 0
        self.current_depth = 0
        self.max_depth = 0
        self.decision_points = 1  # Base complexity = 1
        self.branching_nodes = 0
        self.statement_nodes = 0
        self.function_defs = 0
        self.docstring_count = 0
        self.total_params = 0
        self.annotated_params = 0
        self.comprehensions = 0
        self.loops = 0
        self.try_blocks = 0

    def generic_visit(self, node: ast.AST) -> None:
        self.total_ast_nodes += 1
        if isinstance(node, ast.stmt):
            self.statement_nodes += 1
        super().generic_visit(node)

    def _visit_block(self, node: ast.AST, is_decision: bool = False, is_branching: bool = False) -> None:
        if is_decision:
            self.decision_points += 1
        if is_branching:
            self.branching_nodes += 1

        self.current_depth += 1
        if self.current_depth > self.max_depth:
            self.max_depth = self.current_depth

        self.generic_visit(node)
        self.current_depth -= 1

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.function_defs += 1
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        ):
            self.docstring_count += 1

        # Check parameter annotations
        args = node.args.args + getattr(node.args, "posonlyargs", []) + getattr(node.args, "kwonlyargs", [])
        self.total_params += len(args)
        for arg in args:
            if arg.annotation is not None:
                self.annotated_params += 1
        if node.returns is not None:
            self.total_params += 1
            self.annotated_params += 1

        self._visit_block(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.visit_FunctionDef(node)  # type: ignore

    def visit_If(self, node: ast.If) -> None:
        self._visit_block(node, is_decision=True, is_branching=True)

    def visit_For(self, node: ast.For) -> None:
        self.loops += 1
        self._visit_block(node, is_decision=True, is_branching=True)

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
        self.loops += 1
        self._visit_block(node, is_decision=True, is_branching=True)

    def visit_While(self, node: ast.While) -> None:
        self.loops += 1
        self._visit_block(node, is_decision=True, is_branching=True)

    def visit_Try(self, node: ast.Try) -> None:
        self.try_blocks += 1
        self._visit_block(node, is_decision=False, is_branching=True)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        self._visit_block(node, is_decision=True, is_branching=True)

    def visit_ListComp(self, node: ast.ListComp) -> None:
        self.comprehensions += 1
        self.generic_visit(node)

    def visit_SetComp(self, node: ast.SetComp) -> None:
        self.comprehensions += 1
        self.generic_visit(node)

    def visit_DictComp(self, node: ast.DictComp) -> None:
        self.comprehensions += 1
        self.generic_visit(node)

    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        self.comprehensions += 1
        self.generic_visit(node)


def extract_features(source_code: str) -> Dict[str, float]:
    """
    Extracts a 24-dimensional feature dictionary from Python source code.
    Guarantees all 24 features are present as floats. Never raises exceptions.
    """
    if not source_code or not source_code.strip():
        return {k: 0.0 for k in FEATURE_NAMES}

    # 1. Lexical and Surface metrics
    features = _extract_surface_and_lexical(source_code)

    # 2. AST parsing & Complexity metrics
    lines = source_code.splitlines()
    total_lines = len(lines)

    try:
        tree = ast.parse(source_code)
        visitor = _ASTFeatureVisitor(total_lines)
        visitor.visit(tree)

        features["f12_docstring_coverage"] = float(
            visitor.docstring_count / max(1, visitor.function_defs)
        )
        features["f13_ast_node_density"] = float(
            visitor.total_ast_nodes / max(1, total_lines)
        )
        features["f14_max_nesting_depth"] = float(visitor.max_depth)
        features["f15_cyclomatic_complexity"] = float(visitor.decision_points)
        features["f16_branching_ratio"] = float(
            visitor.branching_nodes / max(1, visitor.statement_nodes)
        )
        features["f17_type_hint_density"] = float(
            visitor.annotated_params / max(1, visitor.total_params)
        )
        total_loop_constructs = visitor.loops + visitor.comprehensions
        features["f18_comprehension_ratio"] = float(
            visitor.comprehensions / max(1, total_loop_constructs)
        )
        features["f19_exception_handling_count"] = float(visitor.try_blocks)

    except SyntaxError:
        # If code has syntax errors, fill AST features with safe default zeros
        features["f12_docstring_coverage"] = 0.0
        features["f13_ast_node_density"] = 0.0
        features["f14_max_nesting_depth"] = 0.0
        features["f15_cyclomatic_complexity"] = 1.0
        features["f16_branching_ratio"] = 0.0
        features["f17_type_hint_density"] = 0.0
        features["f18_comprehension_ratio"] = 0.0
        features["f19_exception_handling_count"] = 0.0

    # Ensure all 24 features exist and are finite
    for feat in FEATURE_NAMES:
        val = features.get(feat, 0.0)
        if math.isnan(val) or math.isinf(val):
            val = 0.0
        features[feat] = float(val)

    return features


def extract_feature_vector(source_code: str) -> np.ndarray:
    """
    Extracts the 24-dimensional feature vector as a 1D numpy array in strict FEATURE_NAMES order.
    """
    feats = extract_features(source_code)
    return np.array([feats[k] for k in FEATURE_NAMES], dtype=np.float64)
