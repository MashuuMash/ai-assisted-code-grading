import ast
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class FunctionMetrics:
    name: str
    start_line: int
    end_line: int
    loc: int
    arg_count: int
    cyclomatic_complexity: int
    max_nesting_depth: int
    return_count: int


@dataclass
class AstQualityIssue:
    rule_code: str
    message: str
    line_number: int | None = None
    column_number: int | None = None
    metric_value: float | None = None
    severity: str = "warning"


@dataclass
class AstAnalysisResult:
    is_valid_python: bool = True
    syntax_error_message: str | None = None
    syntax_error_line: int | None = None
    total_lines: int = 0
    code_lines: int = 0
    comment_lines: int = 0
    blank_lines: int = 0
    function_count: int = 0
    class_count: int = 0
    max_cyclomatic_complexity: int = 1
    max_nesting_depth: int = 0
    functions: list[FunctionMetrics] = field(default_factory=list)
    issues: list[AstQualityIssue] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class _ComplexityVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.complexity = 1

    def visit_If(self, node: ast.If) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_IfExp(self, node: ast.IfExp) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_For(self, node: ast.For) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_While(self, node: ast.While) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_With(self, node: ast.With) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_AsyncWith(self, node: ast.AsyncWith) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_Assert(self, node: ast.Assert) -> None:
        self.complexity += 1
        self.generic_visit(node)

    def visit_BoolOp(self, node: ast.BoolOp) -> None:
        # Each operand beyond the first introduces an additional branch
        if len(node.values) > 1:
            self.complexity += len(node.values) - 1
        self.generic_visit(node)

    def visit_Match(self, node: ast.Match) -> None:
        # Match cases beyond the first introduce branches
        if len(node.cases) > 1:
            self.complexity += len(node.cases) - 1
        self.generic_visit(node)


def calculate_node_complexity(node: ast.AST) -> int:
    visitor = _ComplexityVisitor()
    visitor.visit(node)
    return visitor.complexity


def calculate_max_nesting_depth(node: ast.AST, current_depth: int = 0) -> int:
    block_types = (
        ast.If,
        ast.For,
        ast.AsyncFor,
        ast.While,
        ast.Try,
        ast.With,
        ast.AsyncWith,
    )
    max_depth = current_depth

    for child in ast.iter_child_nodes(node):
        if isinstance(child, block_types):
            child_depth = calculate_max_nesting_depth(child, current_depth + 1)
        elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            # Nested function/class resets block nesting level
            child_depth = calculate_max_nesting_depth(child, 0)
        else:
            child_depth = calculate_max_nesting_depth(child, current_depth)

        if child_depth > max_depth:
            max_depth = child_depth

    return max_depth


class AstAnalyzer:
    def __init__(
        self,
        max_cyclomatic_complexity: int = 10,
        max_nesting_depth: int = 4,
        max_function_length: int = 50,
        max_arguments: int = 5,
    ) -> None:
        self.max_cyclomatic_complexity = max_cyclomatic_complexity
        self.max_nesting_depth = max_nesting_depth
        self.max_function_length = max_function_length
        self.max_arguments = max_arguments

    def analyze_source(self, source_code: str) -> AstAnalysisResult:
        result = AstAnalysisResult()
        lines = source_code.splitlines()
        result.total_lines = len(lines)

        for line in lines:
            stripped = line.strip()
            if not stripped:
                result.blank_lines += 1
            elif stripped.startswith("#"):
                result.comment_lines += 1
            else:
                result.code_lines += 1

        try:
            tree = ast.parse(source_code)
        except SyntaxError as exc:
            result.is_valid_python = False
            result.syntax_error_message = exc.msg
            result.syntax_error_line = exc.lineno
            result.issues.append(
                AstQualityIssue(
                    rule_code="SYNTAX_ERROR",
                    message=f"Syntax error: {exc.msg}",
                    line_number=exc.lineno,
                    column_number=exc.offset,
                    severity="error",
                )
            )
            return result

        global_max_cc = 1
        global_max_depth = calculate_max_nesting_depth(tree)
        result.max_nesting_depth = global_max_depth

        if global_max_depth > self.max_nesting_depth:
            result.issues.append(
                AstQualityIssue(
                    rule_code="DEEP_NESTING",
                    message=(
                        f"Code has maximum control-flow nesting depth of {global_max_depth}, "
                        f"exceeding recommended limit of {self.max_nesting_depth}"
                    ),
                    metric_value=float(global_max_depth),
                    severity="warning",
                )
            )

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                result.class_count += 1
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                result.function_count += 1
                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line)
                func_loc = end_line - start_line + 1
                arg_count = len(node.args.args)

                func_cc = calculate_node_complexity(node)
                if func_cc > global_max_cc:
                    global_max_cc = func_cc

                func_nesting = calculate_max_nesting_depth(node)

                return_count = sum(1 for sub in ast.walk(node) if isinstance(sub, ast.Return))

                func_metrics = FunctionMetrics(
                    name=node.name,
                    start_line=start_line,
                    end_line=end_line,
                    loc=func_loc,
                    arg_count=arg_count,
                    cyclomatic_complexity=func_cc,
                    max_nesting_depth=func_nesting,
                    return_count=return_count,
                )
                result.functions.append(func_metrics)

                # Quality checks per function
                if func_cc > self.max_cyclomatic_complexity:
                    result.issues.append(
                        AstQualityIssue(
                            rule_code="HIGH_CYCLOMATIC_COMPLEXITY",
                            message=(
                                f"Function '{node.name}' has cyclomatic complexity of {func_cc}, "
                                f"exceeding recommended limit of {self.max_cyclomatic_complexity}"
                            ),
                            line_number=start_line,
                            metric_value=float(func_cc),
                            severity="warning",
                        )
                    )

                if func_loc > self.max_function_length:
                    result.issues.append(
                        AstQualityIssue(
                            rule_code="LONG_FUNCTION",
                            message=(
                                f"Function '{node.name}' has {func_loc} lines of code, "
                                f"exceeding recommended limit of {self.max_function_length}"
                            ),
                            line_number=start_line,
                            metric_value=float(func_loc),
                            severity="warning",
                        )
                    )

                if arg_count > self.max_arguments:
                    result.issues.append(
                        AstQualityIssue(
                            rule_code="TOO_MANY_ARGUMENTS",
                            message=(
                                f"Function '{node.name}' has {arg_count} parameters, "
                                f"exceeding recommended limit of {self.max_arguments}"
                            ),
                            line_number=start_line,
                            metric_value=float(arg_count),
                            severity="warning",
                        )
                    )

        result.max_cyclomatic_complexity = global_max_cc
        return result
