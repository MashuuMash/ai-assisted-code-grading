import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.core.config import settings

def is_docker_available() -> bool:
    try:
        res = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
        )
        return res.returncode == 0
    except Exception:
        return False

def generate_pytest_suite(test_cases: List[Any]) -> str:
    """
    Generates a valid pytest file from the assignment's test cases.
    Supports input/output execution checks and direct function testing.
    """
    lines = [
        "import sys",
        "import pytest",
        "import io",
        "from unittest.mock import patch",
        "",
    ]

    for idx, tc in enumerate(test_cases):
        name = getattr(tc, "name", f"test_case_{idx + 1}")
        clean_name = "".join(c if c.isalnum() or c == "_" else "_" for c in name).strip("_")
        if not clean_name:
            clean_name = f"case_{idx + 1}"
            
        inp = getattr(tc, "input_data", "")
        expected = getattr(tc, "expected_output", "").strip()

        # Generate test function
        lines.append(f"def test_{clean_name}():")
        lines.append(f'    """{name}"""')
        
        # If test case has input_data, mock stdin and capture stdout
        lines.append(f"    input_data = {repr(inp)}")
        lines.append(f"    expected_output = {repr(expected)}")
        lines.append("    captured_output = io.StringIO()")
        lines.append("    with patch('sys.stdin', io.StringIO(input_data)), patch('sys.stdout', captured_output):")
        lines.append("        # Import and execute solution if solution.py exists, or main.py")
        lines.append("        try:")
        lines.append("            if 'solution' in sys.modules: del sys.modules['solution']")
        lines.append("            if 'main' in sys.modules: del sys.modules['main']")
        lines.append("            mod = None")
        lines.append("            try:")
        lines.append("                import solution as mod")
        lines.append("            except ImportError:")
        lines.append("                import main as mod")
        lines.append("            if hasattr(mod, 'main') and callable(getattr(mod, 'main')):")
        lines.append("                mod.main()")
        lines.append("        except Exception as e:")
        lines.append("            pytest.fail(f'Failed to import or execute solution: {e}')")
        lines.append("    actual = captured_output.getvalue().strip()")
        lines.append("    assert actual == expected_output, f'Expected {repr(expected_output)}, but got {repr(actual)}'")
        lines.append("")

    return "\n".join(lines)


def run_code_in_sandbox(
    student_files: Dict[str, str],
    test_cases: List[Any],
    timeout_sec: int = 10,
    memory_limit_mb: int = 256,
) -> Dict[str, Any]:
    """
    Executes student code against test cases in Docker container,
    or falls back safely to isolated subprocess if Docker daemon is not active.
    """
    temp_dir = tempfile.mkdtemp(prefix="pygrade_exec_")
    try:
        # Write student files to temp_dir
        for rel_path, content in student_files.items():
            file_path = Path(temp_dir) / rel_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

        # Generate and write pytest suite
        suite_code = generate_pytest_suite(test_cases)
        test_file = Path(temp_dir) / "test_suite.py"
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(suite_code)

        # Copy runner.py
        runner_src = Path(__file__).resolve().parent.parent.parent.parent / "sandbox" / "runner.py"
        runner_dest = Path(temp_dir) / "runner.py"
        if runner_src.exists():
            shutil.copy(runner_src, runner_dest)

        docker_ready = is_docker_available()

        if docker_ready:
            return _execute_docker(
                temp_dir=temp_dir,
                timeout_sec=timeout_sec,
                memory_limit_mb=memory_limit_mb,
            )
        else:
            return _execute_subprocess(
                temp_dir=temp_dir,
                timeout_sec=timeout_sec,
            )

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _execute_docker(temp_dir: str, timeout_sec: int, memory_limit_mb: int) -> Dict[str, Any]:
    # Docker run with maximum isolation
    docker_cmd = [
        "docker", "run", "--rm",
        "--network", "none",
        "--read-only",
        "--user", "10001:10001",
        "--cpus", "1.0",
        "--memory", f"{memory_limit_mb}m",
        "--pids-limit", "64",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
        "-v", f"{temp_dir}:/sandbox/workspace:ro",
        settings.DOCKER_IMAGE_NAME,
        "--test-file", "/sandbox/workspace/test_suite.py",
        "--code-dir", "/sandbox/workspace",
    ]

    try:
        proc = subprocess.run(
            docker_cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec + 2,
        )
        return _parse_runner_output(proc.stdout, proc.stderr, proc.returncode)
    except subprocess.TimeoutExpired:
        return {
            "status": "TIMEOUT",
            "passed_count": 0,
            "failed_count": 1,
            "total_count": 1,
            "execution_time_ms": timeout_sec * 1000,
            "test_details": [{
                "name": "timeout_watchdog",
                "status": "TIMEOUT",
                "duration_ms": timeout_sec * 1000,
                "message": f"Execution exceeded maximum allowable limit of {timeout_sec} seconds.",
            }],
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "passed_count": 0,
            "failed_count": 1,
            "total_count": 1,
            "execution_time_ms": 0,
            "test_details": [{
                "name": "docker_error",
                "status": "ERROR",
                "duration_ms": 0,
                "message": str(e),
            }],
        }


def _execute_subprocess(temp_dir: str, timeout_sec: int) -> Dict[str, Any]:
    python_bin = sys.executable
    runner_script = Path(temp_dir) / "runner.py"
    test_file = Path(temp_dir) / "test_suite.py"

    cmd = [
        python_bin,
        str(runner_script),
        "--test-file", str(test_file),
        "--code-dir", str(temp_dir),
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=temp_dir,
            timeout=timeout_sec,
        )
        return _parse_runner_output(proc.stdout, proc.stderr, proc.returncode)
    except subprocess.TimeoutExpired:
        return {
            "status": "TIMEOUT",
            "passed_count": 0,
            "failed_count": 1,
            "total_count": 1,
            "execution_time_ms": timeout_sec * 1000,
            "test_details": [{
                "name": "timeout_watchdog",
                "status": "TIMEOUT",
                "duration_ms": timeout_sec * 1000,
                "message": f"Subprocess execution timed out after {timeout_sec} seconds.",
            }],
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "passed_count": 0,
            "failed_count": 1,
            "total_count": 1,
            "execution_time_ms": 0,
            "test_details": [{
                "name": "subprocess_execution_error",
                "status": "ERROR",
                "duration_ms": 0,
                "message": str(e),
            }],
        }


def _parse_runner_output(stdout: str, stderr: str, returncode: int) -> Dict[str, Any]:
    start_tag = "---PYGRADE_OUTPUT_START---"
    end_tag = "---PYGRADE_OUTPUT_END---"

    if start_tag in stdout and end_tag in stdout:
        json_str = stdout.split(start_tag)[1].split(end_tag)[0].strip()
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

    # If tags not found or failed
    return {
        "status": "ERROR" if returncode != 0 else "SUCCESS",
        "passed_count": 0,
        "failed_count": 1 if returncode != 0 else 0,
        "total_count": 1,
        "execution_time_ms": 0,
        "test_details": [{
            "name": "execution_output",
            "status": "ERROR" if returncode != 0 else "PASSED",
            "duration_ms": 0,
            "message": f"STDOUT: {stdout}\nSTDERR: {stderr}",
        }],
    }
