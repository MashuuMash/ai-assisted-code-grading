import ast
import json
import subprocess
import tempfile
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from app.core.config import settings

class ComplexityVisitor(ast.NodeVisitor):
    def __init__(self):
        self.functions: List[Dict[str, Any]] = []
        self.current_function: Optional[str] = None
        self.current_complexity = 1
        self.max_nesting_depth = 0
        self.current_nesting_depth = 0
        self.recursive_functions: Set[str] = set()
        self.imports: List[str] = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            self.imports.append(node.module)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._visit_function(node)

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef):
        prev_function = self.current_function
        prev_complexity = self.current_complexity
        
        self.current_function = node.name
        self.current_complexity = 1

        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

        self.functions.append({
            "name": node.name,
            "lineno": node.lineno,
            "complexity": self.current_complexity,
            "is_recursive": node.name in self.recursive_functions,
        })

        self.current_function = prev_function
        self.current_complexity = prev_complexity

    def visit_Call(self, node: ast.Call):
        if self.current_function and isinstance(node.func, ast.Name):
            if node.func.id == self.current_function:
                self.recursive_functions.add(self.current_function)
        self.generic_visit(node)

    # Decision points contributing to cyclomatic complexity
    def visit_If(self, node: ast.If):
        self.current_complexity += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_For(self, node: ast.For):
        self.current_complexity += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_AsyncFor(self, node: ast.AsyncFor):
        self.current_complexity += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_While(self, node: ast.While):
        self.current_complexity += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        self.current_complexity += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_With(self, node: ast.With):
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_BoolOp(self, node: ast.BoolOp):
        # A and B has 2 values -> 1 extra decision point
        self.current_complexity += len(node.values) - 1
        self.generic_visit(node)

    def visit_comprehension(self, node: ast.comprehension):
        self.current_complexity += 1 + len(node.ifs)
        self.generic_visit(node)

    def _enter_block(self):
        self.current_nesting_depth += 1
        if self.current_nesting_depth > self.max_nesting_depth:
            self.max_nesting_depth = self.current_nesting_depth

    def _exit_block(self):
        self.current_nesting_depth -= 1


def analyze_ast(source_code: str, banned_modules: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Analyzes Python source code using AST to extract cyclomatic complexity,
    nesting depth, recursion, lines of code, and banned imports.
    """
    if banned_modules is None:
        banned_modules = ["subprocess", "os", "sys", "socket", "urllib", "requests"]

    loc_total = len([line for line in source_code.splitlines() if line.strip() and not line.strip().startswith("#")])
    
    try:
        tree = ast.parse(source_code)
    except SyntaxError as e:
        return {
            "syntax_valid": False,
            "error": str(e),
            "cyclomatic_complexity_max": 0,
            "cyclomatic_complexity_avg": Decimal("0.00"),
            "max_nesting_depth": 0,
            "loc_total": loc_total,
            "function_count": 0,
            "banned_imports_found": [],
            "functions": [],
        }

    visitor = ComplexityVisitor()
    visitor.visit(tree)

    func_count = len(visitor.functions)
    if func_count > 0:
        max_cc = max(f["complexity"] for f in visitor.functions)
        avg_cc = Decimal(str(round(sum(f["complexity"] for f in visitor.functions) / func_count, 2)))
    else:
        max_cc = visitor.current_complexity
        avg_cc = Decimal(str(max_cc))

    # Detect banned imports
    found_banned = []
    for imp in visitor.imports:
        top_module = imp.split(".")[0]
        if top_module in banned_modules and top_module not in found_banned:
            found_banned.append(top_module)

    return {
        "syntax_valid": True,
        "cyclomatic_complexity_max": max_cc,
        "cyclomatic_complexity_avg": avg_cc,
        "max_nesting_depth": visitor.max_nesting_depth,
        "loc_total": loc_total,
        "function_count": func_count,
        "banned_imports_found": found_banned,
        "functions": visitor.functions,
    }


def run_ruff_linter(files_dict: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Runs Ruff linter on in-memory source files and extracts structured JSON diagnostics.
    """
    temp_dir = tempfile.mkdtemp(prefix="pygrade_ruff_")
    try:
        for rel_path, content in files_dict.items():
            if rel_path.endswith(".py"):
                file_path = Path(temp_dir) / rel_path
                file_path.parent.mkdir(parents=True, exist_ok=True)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)

        cmd = [
            settings.RUFF_EXECUTABLE,
            "check",
            "--output-format=json",
            temp_dir,
        ]

        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
        )

        if not res.stdout.strip():
            return []

        try:
            raw_issues = json.loads(res.stdout)
            clean_issues = []
            for item in raw_issues:
                filename = Path(item.get("filename", "")).name
                clean_issues.append({
                    "code": item.get("code", "UNKNOWN"),
                    "message": item.get("message", ""),
                    "filename": filename,
                    "location": {
                        "row": item.get("location", {}).get("row", 1),
                        "column": item.get("location", {}).get("column", 1),
                    },
                    "end_location": {
                        "row": item.get("end_location", {}).get("row", 1),
                        "column": item.get("end_location", {}).get("column", 1),
                    },
                })
            return clean_issues
        except json.JSONDecodeError:
            return []
    except Exception:
        return []
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
