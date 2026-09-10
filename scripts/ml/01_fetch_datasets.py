"""
Dataset Fetching & Verification Script for Stage A Feasibility Pilot.
Retrieves and validates Google Research MBPP (CC-BY-4.0) and inspects local archives.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

MBPP_RAW_URL = "https://raw.githubusercontent.com/google-research/google-research/master/mbpp/mbpp.jsonl"


def verify_mbpp() -> dict:
    print(f"[*] Checking MBPP endpoint: {MBPP_RAW_URL} ...")
    try:
        resp = httpx.get(MBPP_RAW_URL, timeout=15.0)
        resp.raise_for_status()
        lines = [l.strip() for l in resp.text.splitlines() if l.strip()]
        sample = json.loads(lines[0])
        return {
            "status": "OK",
            "total_lines": len(lines),
            "sample_task_id": sample.get("task_id"),
            "sample_prompt": sample.get("text")[:80],
            "license": "CC-BY-4.0 (Google Research)",
            "bytes": len(resp.content),
        }
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}


def fetch_and_save_mbpp(output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[*] Downloading MBPP dataset from {MBPP_RAW_URL} ...")
    resp = httpx.get(MBPP_RAW_URL, timeout=30.0)
    resp.raise_for_status()

    lines = [l.strip() for l in resp.text.splitlines() if l.strip()]
    valid_records = []
    for line in lines:
        try:
            rec = json.loads(line)
            if "task_id" in rec and "code" in rec and rec["code"].strip():
                valid_records.append({
                    "problem_id": f"mbpp_{rec['task_id']}",
                    "task_id": rec["task_id"],
                    "prompt": rec.get("text", "").strip(),
                    "code": rec["code"].strip(),
                    "source": "mbpp_reference",
                    "label": 0,  # Human
                })
        except json.JSONDecodeError:
            continue

    with open(output_path, "w", encoding="utf-8") as f:
        for r in valid_records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"[+] Saved {len(valid_records)} verified MBPP records to {output_path}")
    return len(valid_records)


def main():
    parser = argparse.ArgumentParser(description="Fetch and verify datasets for Stage A pilot.")
    parser.add_argument("--verify-only", action="store_true", help="Only verify source availability and schema.")
    parser.add_argument("--output", type=str, default="data/raw/mbpp/mbpp_verified.jsonl", help="Output path.")
    args = parser.parse_args()

    result = verify_mbpp()
    print(json.dumps(result, indent=2))

    if args.verify_only:
        print("[*] Verification complete.")
        sys.exit(0 if result["status"] == "OK" else 1)

    output_path = Path(args.output)
    count = fetch_and_save_mbpp(output_path)
    print(f"[+] Stage A Human Dataset assembly complete: {count} problems.")


if __name__ == "__main__":
    main()
