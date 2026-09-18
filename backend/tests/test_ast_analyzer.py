from app.ast_analyzer import AstAnalyzer


def test_ast_simple_script():
    code = """
# This is a comment
def add(a, b):
    return a + b
"""
    analyzer = AstAnalyzer()
    res = analyzer.analyze_source(code)
    assert res.is_valid_python is True
    assert res.function_count == 1
    assert res.functions[0].name == "add"
    assert res.functions[0].arg_count == 2
    assert res.functions[0].cyclomatic_complexity == 1
    assert res.max_nesting_depth == 0
    assert len(res.issues) == 0


def test_ast_cyclomatic_complexity():
    code = """
def complex_decision(x, y, z):
    if x > 0 and y > 0:
        for i in range(10):
            if i == 5:
                break
    elif z > 0 or x < -10:
        while z > 0:
            z -= 1
    else:
        try:
            return x / y
        except ZeroDivisionError:
            return 0
    return -1
"""
    analyzer = AstAnalyzer()
    res = analyzer.analyze_source(code)
    assert res.is_valid_python is True
    assert res.function_count == 1
    # Base 1 + If (1) + and (1) + For (1) + If (1) + elif (1) + or (1) + While (1) + Except (1) = 9
    assert res.functions[0].cyclomatic_complexity >= 8


def test_ast_deep_nesting_detection():
    code = """
def deeply_nested():
    if True:
        for a in range(10):
            while True:
                try:
                    if False:
                        print("deep")
                except Exception:
                    pass
"""
    analyzer = AstAnalyzer(max_nesting_depth=3)
    res = analyzer.analyze_source(code)
    assert res.max_nesting_depth >= 4
    deep_issues = [i for i in res.issues if i.rule_code == "DEEP_NESTING"]
    assert len(deep_issues) == 1
    assert deep_issues[0].severity == "warning"


def test_ast_high_complexity_warning():
    # Construct a function with many decision branches
    branches = "\n".join([f"    if x == {i}: return {i}" for i in range(15)])
    code = f"def many_branches(x):\n{branches}\n    return -1\n"

    analyzer = AstAnalyzer(max_cyclomatic_complexity=10)
    res = analyzer.analyze_source(code)
    cc_issues = [i for i in res.issues if i.rule_code == "HIGH_CYCLOMATIC_COMPLEXITY"]
    assert len(cc_issues) == 1
    assert cc_issues[0].metric_value >= 15


def test_ast_syntax_error_handling():
    code = """
def broken_syntax(
    print "Missing closing paren and invalid syntax"
"""
    analyzer = AstAnalyzer()
    res = analyzer.analyze_source(code)
    assert res.is_valid_python is False
    assert res.syntax_error_message is not None
    assert len(res.issues) == 1
    assert res.issues[0].rule_code == "SYNTAX_ERROR"
    assert res.issues[0].severity == "error"
