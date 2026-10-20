"""Prepare public AIGCodeSet without executing any collected code (stdlib only)."""

import argparse
import csv
import hashlib
import io
import json
import random
import re
import tokenize
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

REPO = "basakdemirok/AIGCodeSet"
REVISION = "b4d4e69fdbcba2608c99808c6afbf53a3bfd108c"
FILES = ("human_selected_dataset.csv", "created_dataset_with_llms.csv")
GENERATORS = {"CODESTRAL", "GEMINI", "LLAMA"}
EXPECTED_SHA256 = {
    "human_selected_dataset.csv": "f02f1099de41434e67f26dd0470e8cce32ac1a80966cea51c8f9a25b95991de8",
    "created_dataset_with_llms.csv": "be858efdb3233dff32b4cf239171dd686f9fb968d26cb0ab44c668fa40b2226e",
    "README.md": "366485d67d815f9a8ca8e6feaecca8fa615144615d595af38c6a8686c496470d",
}


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def clean_code(code):
    """Strip a whole-output Markdown fence symmetrically, not comments/docstrings."""
    code = code.replace("\r\n", "\n").replace("\r", "\n").strip()
    match = re.fullmatch(
        r"```(?:python|py)?\s*\n(.*?)\n```", code, re.DOTALL | re.IGNORECASE
    )
    return (match.group(1).strip() if match else code) + "\n"


def normalized_hash(code):
    try:
        tokens = [
            (t.type, t.string)
            for t in tokenize.generate_tokens(io.StringIO(code).readline)
            if t.type
            not in {
                tokenize.COMMENT,
                tokenize.NL,
                tokenize.NEWLINE,
                tokenize.INDENT,
                tokenize.DEDENT,
                tokenize.ENDMARKER,
            }
        ]
        return digest(json.dumps(tokens, ensure_ascii=False))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        # Retain malformed human code; don't make syntax validity a label filter.
        return digest(code)


def read_sources(root):
    records, excluded = [], Counter()
    for filename in FILES:
        with (root / filename).open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            required = {
                "problem_id",
                "submission_id",
                "LLM",
                "status_in_folder",
                "code",
                "label",
            }
            if not required.issubset(reader.fieldnames or []):
                raise ValueError(f"Unexpected schema in {filename}")
            for index, row in enumerate(reader):
                label = int(row["label"])
                generator = row["LLM"].strip().upper()
                if label not in (0, 1) or (label == 0) != (generator == "HUMAN"):
                    raise ValueError("Label/source mismatch; do not infer or relabel")
                if label == 1 and generator not in GENERATORS:
                    raise ValueError(f"Unknown AI generator: {generator}")
                if label == 1 and row["status_in_folder"].strip().lower() != "generate":
                    excluded["ai_repair_or_hybrid"] += 1
                    continue
                if row.get("language", "Python").lower() != "python":
                    excluded["non_python"] += 1
                    continue
                if not row["code"].strip() or not row["problem_id"].strip():
                    excluded["empty_code_or_problem"] += 1
                    continue
                code = clean_code(row["code"])
                records.append(
                    {
                        "record_id": f"{filename}:{index}",
                        "code": code,
                        "label": label,
                        "problem_id": row["problem_id"].strip(),
                        "generator": generator,
                        "status": row["status_in_folder"],
                        "sha256": digest(code),
                        "normalized_hash": normalized_hash(code),
                    }
                )
    return records, dict(excluded)


def make_splits(records, seed=42, heldout="LLAMA"):
    """Group connected problems via duplicate code, then split before withholding LLM."""
    if heldout not in GENERATORS:
        raise ValueError("heldout must be a known generator")
    parent = {r["problem_id"]: r["problem_id"] for r in records}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_hash = defaultdict(list)
    for row in records:
        by_hash[row["normalized_hash"]].append(row)
    unique, conflicts = [], 0
    for group in by_hash.values():
        if len({r["label"] for r in group}) > 1:
            conflicts += len(group)
            continue  # Identical code with conflicting provenance is not identifiable.
        for row in group[1:]:
            parent[find(row["problem_id"])] = find(group[0]["problem_id"])
        unique.append(min(group, key=lambda r: r["record_id"]))
    groups = sorted({find(r["problem_id"]) for r in unique})
    if len(groups) < 20:
        raise ValueError("Need at least 20 independent problem groups")
    random.Random(seed).shuffle(groups)
    first, second = int(len(groups) * 0.65), int(len(groups) * 0.80)
    assignment = {
        g: ("train" if i < first else "validation" if i < second else "test")
        for i, g in enumerate(groups)
    }
    splits = {name: [] for name in ("train", "validation", "test_seen", "test_unseen")}
    excluded_heldout = 0
    for row in unique:
        row = dict(row, group_id=find(row["problem_id"]))
        partition = assignment[row["group_id"]]
        if partition != "test":
            if row["generator"] == heldout:
                excluded_heldout += 1
            else:
                splits[partition].append(row)
        else:
            if row["generator"] != heldout:
                splits["test_seen"].append(row)
            if row["label"] == 0 or row["generator"] == heldout:
                splits["test_unseen"].append(row)
    for name, rows in splits.items():
        if {r["label"] for r in rows} != {0, 1}:
            raise ValueError(
                f"{name} lacks both labels; inspect data rather than silently changing split"
            )
    for left, right in (
        ("train", "validation"),
        ("train", "test_seen"),
        ("train", "test_unseen"),
        ("validation", "test_seen"),
        ("validation", "test_unseen"),
    ):
        for field in ("problem_id", "group_id", "normalized_hash"):
            assert not (
                {r[field] for r in splits[left]} & {r[field] for r in splits[right]}
            )
    return splits, {
        "conflicting_provenance_rows_removed": conflicts,
        "same_label_duplicate_rows_removed": len(records) - len(unique) - conflicts,
        "heldout_rows_excluded_from_train_validation": excluded_heldout,
        "independent_groups": len(groups),
    }


def prepare(output, seed=42, heldout="LLAMA"):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    raw = output / "raw"
    raw.mkdir(exist_ok=True)
    checksums = {}
    for name in (*FILES, "README.md"):
        path = raw / name
        if not path.exists():
            relative = name if name == "README.md" else f"data/{name}"
            url = (
                f"https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/{relative}"
            )
            with urllib.request.urlopen(url, timeout=120) as response:
                content = response.read(30_000_001)
            if len(content) > 30_000_000:
                raise ValueError("Unexpected download size")
            path.write_bytes(content)
        checksums[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        if checksums[name] != EXPECTED_SHA256[name]:
            raise ValueError(
                f"Checksum mismatch: {path}. Do not use a changed dataset silently."
            )
    records, excluded = read_sources(raw)
    splits, audit = make_splits(records, seed, heldout)
    for name, rows in splits.items():
        (output / f"{name}.jsonl").write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
            encoding="utf-8",
        )
    report = {
        "dataset": REPO,
        "revision": REVISION,
        "license_declared_by_publisher": "CDLA-Permissive-2.0",
        "seed": seed,
        "heldout_generator": heldout,
        "raw_sha256": checksums,
        "excluded": excluded,
        "audit": audit,
        "splits": {
            name: {
                "rows": len(rows),
                "labels": dict(Counter(r["label"] for r in rows)),
                "generators": dict(Counter(r["generator"] for r in rows)),
                "problems": len({r["problem_id"] for r in rows}),
            }
            for name, rows in splits.items()
        },
        "limitations": [
            "test_seen and test_unseen reuse human test controls; do not pool them",
            "No author-disjoint guarantee or pretrained-model contamination check",
            "Token-normalized dedup is not full semantic near-duplicate detection",
            "Dataset provenance labels are publisher assertions, not proof of authorship",
            "AI repair/hybrid code excluded; no claim on mixed human/AI code",
        ],
    }
    (output / "data_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="experiments/codebert/data/aigcodeset")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--heldout", default="LLAMA", choices=sorted(GENERATORS))
    args = parser.parse_args()
    print(json.dumps(prepare(args.output, args.seed, args.heldout), indent=2))
