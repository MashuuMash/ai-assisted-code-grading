from unittest.mock import MagicMock
from app.execution.runner import run_code_in_sandbox

def test_sandbox_passing_solution():
    student_files = {
        "solution.py": """
import sys

def main():
    inp = sys.stdin.read().strip()
    if inp:
        nums = [int(x) for x in inp.split()]
        print(sum(nums))

if __name__ == "__main__":
    main()
"""
    }

    test_cases = [
        MagicMock(name="case_1", input_data="1 2 3", expected_output="6"),
        MagicMock(name="case_2", input_data="10 -5", expected_output="5"),
    ]

    res = run_code_in_sandbox(student_files, test_cases, timeout_sec=5)
    assert res["status"] == "SUCCESS"
    assert res["passed_count"] == 2
    assert res["failed_count"] == 0

def test_sandbox_failing_solution():
    student_files = {
        "solution.py": """
import sys
print("Wrong Answer")
"""
    }

    test_cases = [
        MagicMock(name="case_1", input_data="hello", expected_output="hello world"),
    ]

    res = run_code_in_sandbox(student_files, test_cases, timeout_sec=5)
    assert res["status"] == "FAILED"
    assert res["failed_count"] == 1

def test_sandbox_timeout_containment():
    infinite_loop_code = {
        "solution.py": """
import time
while True:
    time.sleep(0.1)
"""
    }

    test_cases = [
        MagicMock(name="case_timeout", input_data="", expected_output="done"),
    ]

    res = run_code_in_sandbox(infinite_loop_code, test_cases, timeout_sec=2)
    assert res["status"] == "TIMEOUT"
