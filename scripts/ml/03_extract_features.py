"""
Feature Extraction Batch Pipeline for Stage A Pilot.
Compiles 24-dimensional feature representations for human and synthetic corpora.
Enforces deduplication and problem grouping.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.ai_integrity.feature_extractor import FEATURE_NAMES, extract_features


def process_corpus(human_path: Path, synthetic_path: Path, output_path: Path, limit_per_class: int = 300):
    output_path.parent.mkdir(parents=True, exist_ok=True)

    human_samples = []
    with open(human_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                human_samples.append(json.loads(line))
    human_samples = human_samples[:limit_per_class]

    synthetic_samples = []
    with open(synthetic_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                synthetic_samples.append(json.loads(line))
    synthetic_samples = synthetic_samples[:limit_per_class]

    all_raw = human_samples + synthetic_samples
    print(f"[*] Processing {len(all_raw)} total samples ({len(human_samples)} human, {len(synthetic_samples)} synthetic)...")

    processed = []
    seen_hashes = set()
    skipped_duplicates = 0

    for item in all_raw:
        code = item["code"].strip()
        code_hash = hash(code)
        if code_hash in seen_hashes:
            skipped_duplicates += 1
            continue
        seen_hashes.add(code_hash)

        feats = extract_features(code)
        feat_vector = [feats[name] for name in FEATURE_NAMES]

        processed.append({
            "problem_id": item["problem_id"],
            "label": item["label"],
            "source": item.get("source", "unknown"),
            "features": feat_vector,
        })

    with open(output_path, "w", encoding="utf-8") as f:
        for rec in processed:
            f.write(json.dumps(rec) + "\n")

    print(f"[+] Feature extraction completed:")
    print(f"    - Output: {output_path}")
    print(f"    - Total retained records: {len(processed)}")
    print(f"    - Duplicates filtered: {skipped_duplicates}")
    print(f"    - Feature dimensions: {len(FEATURE_NAMES)}")


def main():
    parser = argparse.ArgumentParser(description="Extract 24D features for Stage A dataset.")
    parser.add_argument("--human", type=str, default="data/raw/mbpp/mbpp_verified.jsonl")
    parser.add_argument("--synthetic", type=str, default="data/raw/synthetic/synthetic_stage_a.jsonl")
    parser.add_argument("--output", type=str, default="data/processed/features_stage_a.jsonl")
    parser.add_argument("--limit", type=int, default=300)
    args = parser.parse_args()

    process_corpus(Path(args.human), Path(args.synthetic), Path(args.output), limit_per_class=args.limit)


if __name__ == "__main__":
    main()
