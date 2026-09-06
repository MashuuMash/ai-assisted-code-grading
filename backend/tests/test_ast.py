from decimal import Decimal
from app.quality_ast.analyzer import analyze_ast

def test_ast_cyclomatic_complexity():
    code = """
def calculate(x):
    if x > 10:
        for i in range(x):
            if i % 2 == 0:
                print(i)
    elif x < 0:
        while x < 0:
            x += 1
    return x
"""
    result = analyze_ast(code)
    assert result["syntax_valid"] is True
    # Initial 1 + if (1) + for (1) + if (1) + elif (1) + while (1) = 6
    assert result["cyclomatic_complexity_max"] >= 5
    assert result["max_nesting_depth"] >= 3
    assert result["function_count"] == 1

def test_ast_recursion_detection():
    recursive_code = """
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
"""
    result = analyze_ast(recursive_code)
    assert result["syntax_valid"] is True
    funcs = result["functions"]
    assert len(funcs) == 1
    assert funcs[0]["is_recursive"] is True

def test_ast_banned_imports():
    malicious_code = """
import os
import subprocess
import math

def run():
    print("Safe function")
"""
    result = analyze_ast(malicious_code, banned_modules=["os", "subprocess", "socket"])
    assert result["syntax_valid"] is True
    assert "os" in result["banned_imports_found"]
    assert "subprocess" in result["banned_imports_found"]
    assert "math" not in result["banned_imports_found"]
