#!/usr/bin/env python3
"""
Enforce strict no-emoji policy across all repository code files.
Scans source files and fails with exit code 1 if any emoji character is detected.
"""

import os
import sys
import unicodedata
from pathlib import Path

# Directories to exclude from scanning
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

# File extensions to scan
INCLUDED_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".sql",
    ".sh",
    ".bash",
    ".yml",
    ".yaml",
    ".json",
    ".css",
    ".scss",
    ".html",
    ".toml",
    ".ini",
    ".mako",
    ".env",
    ".example",
}


def is_emoji(char: str) -> bool:
    """Return True if character falls within known emoji ranges."""
    cp = ord(char)

    # Miscellaneous Symbols and Dingbats
    if 0x2600 <= cp <= 0x27BF:
        return True
    # Miscellaneous Symbols and Arrows
    if 0x2B50 <= cp <= 0x2B55:
        return True
    # Emoji variation selector
    if cp == 0xFE0F:
        return True
    # Mahjong, Domino, Playing Cards
    if 0x1F000 <= cp <= 0x1F02F:
        return True
    # Enclosed alphanumeric supplement (regional indicators, etc.)
    if 0x1F1E6 <= cp <= 0x1F1FF:
        return True
    # Miscellaneous Symbols and Pictographs
    if 0x1F300 <= cp <= 0x1F5FF:
        return True
    # Emoticons
    if 0x1F600 <= cp <= 0x1F64F:
        return True
    # Transport and Map Symbols
    if 0x1F680 <= cp <= 0x1F6FF:
        return True
    # Supplemental Symbols and Pictographs
    if 0x1F900 <= cp <= 0x1F9FF:
        return True
    # Symbols and Pictographs Extended-A
    return 0x1FA70 <= cp <= 0x1FAFF


def scan_file(file_path: Path) -> list[tuple[int, int, str, str]]:
    """Scan a single file for emoji characters. Returns list of (line_num, col_num, char, line_content)."""
    violations = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            for line_idx, line in enumerate(f, start=1):
                for col_idx, char in enumerate(line, start=1):
                    if is_emoji(char):
                        char_name = unicodedata.name(char, "UNKNOWN")
                        violations.append((line_idx, col_idx, f"U+{ord(char):04X} ({char_name})", line.strip()))
    except OSError as exc:
        print(f"Error reading {file_path}: {exc}", file=sys.stderr)
    return violations


def main() -> int:
    root_dir = Path(__file__).resolve().parent.parent
    total_files_scanned = 0
    total_violations = 0

    for current_root, dirs, files in os.walk(root_dir):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]

        for file_name in files:
            file_path = Path(current_root) / file_name
            ext = file_path.suffix.lower()

            # Handle files like .env.example
            is_scannable = ext in INCLUDED_EXTENSIONS or file_name.startswith(".env") or file_name in {"Makefile", "Dockerfile"}
            if not is_scannable:
                continue

            total_files_scanned += 1
            violations = scan_file(file_path)
            if violations:
                total_violations += len(violations)
                rel_path = file_path.relative_to(root_dir)
                for line_num, col_num, char_info, line_preview in violations:
                    print(
                        f"[EMOJI VIOLATION] {rel_path}:{line_num}:{col_num} - {char_info}\n"
                        f"  Line: {line_preview}",
                        file=sys.stderr,
                    )

    print(f"Scanned {total_files_scanned} files.")
    if total_violations > 0:
        print(
            f"FAILED: Found {total_violations} emoji character(s) in codebase. Emojis are strictly forbidden.",
            file=sys.stderr,
        )
        return 1

    print("PASSED: Zero emojis found in codebase.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
