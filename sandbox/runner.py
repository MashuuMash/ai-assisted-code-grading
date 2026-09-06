import argparse
import json
import os
import sys
import time
import pytest

class PygradeReporter:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0

    def pytest_runtest_logreport(self, report):
        if report.when == "call":
            duration_ms = int(report.duration * 1000)
            if report.passed:
                self.passed += 1
                self.results.append({
                    "name": report.nodeid.split("::")[-1],
                    "status": "PASSED",
                    "duration_ms": duration_ms,
                    "message": None,
                })
            elif report.failed:
                self.failed += 1
                msg = str(report.longrepr) if report.longrepr else "Test assertion failed"
                self.results.append({
                    "name": report.nodeid.split("::")[-1],
                    "status": "FAILED",
                    "duration_ms": duration_ms,
                    "message": msg,
                })
        elif report.when == "setup" and report.failed:
            self.failed += 1
            self.results.append({
                "name": report.nodeid.split("::")[-1] if "::" in report.nodeid else report.nodeid,
                "status": "ERROR",
                "duration_ms": int(report.duration * 1000),
                "message": f"Setup failure: {report.longrepr}",
            })

def run_tests(test_file: str, code_dir: str) -> dict:
    if code_dir not in sys.path:
        sys.path.insert(0, code_dir)
        
    reporter = PygradeReporter()
    start_time = time.perf_counter()
    
    # Run pytest programmatically
    args = [
        "-q",
        "--tb=short",
        "--no-header",
    ]
    try:
        import pytest_timeout
        args.append("--timeout=5")
    except ImportError:
        pass

    args.append(test_file)
    
    try:
        exit_code = pytest.main(args, plugins=[reporter])
        total_time_ms = int((time.perf_counter() - start_time) * 1000)
        total_count = reporter.passed + reporter.failed
        
        status = "SUCCESS" if reporter.failed == 0 and total_count > 0 else "FAILED"
        if total_count == 0:
            status = "ERROR"
            
        return {
            "status": status,
            "passed_count": reporter.passed,
            "failed_count": reporter.failed,
            "total_count": total_count,
            "execution_time_ms": total_time_ms,
            "test_details": reporter.results,
        }
    except Exception as e:
        total_time_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "status": "ERROR",
            "passed_count": 0,
            "failed_count": 1,
            "total_count": 1,
            "execution_time_ms": total_time_ms,
            "test_details": [{
                "name": "harness_execution",
                "status": "ERROR",
                "duration_ms": total_time_ms,
                "message": str(e),
            }],
        }

def main():
    parser = argparse.ArgumentParser(description="PyGrade Test Sandbox Runner")
    parser.add_argument("--test-file", required=True, help="Path to test file")
    parser.add_argument("--code-dir", required=True, help="Path to student code directory")
    args = parser.parse_args()

    result = run_tests(args.test_file, args.code_dir)
    print("---PYGRADE_OUTPUT_START---")
    print(json.dumps(result))
    print("---PYGRADE_OUTPUT_END---")

if __name__ == "__main__":
    main()
