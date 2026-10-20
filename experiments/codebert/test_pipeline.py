import tempfile
import unittest
from pathlib import Path

from evaluation import (
    abstention_metrics,
    binary_metrics,
    select_threshold,
    wilson_upper,
)
from prepare_data import clean_code, digest, make_splits, normalized_hash, read_sources


def synthetic_records():
    rows = []
    for p in range(100):
        for generator, label in (
            ("HUMAN", 0),
            ("GEMINI", 1),
            ("CODESTRAL", 1),
            ("LLAMA", 1),
        ):
            code = f"print({p}, {generator!r})\n"
            rows.append(
                {
                    "record_id": f"{p}:{generator}",
                    "code": code,
                    "label": label,
                    "problem_id": f"p{p}",
                    "generator": generator,
                    "sha256": digest(code),
                    "normalized_hash": normalized_hash(code),
                }
            )
    return rows


class PipelineTests(unittest.TestCase):
    def test_normalize_and_keep_syntax_errors(self):
        self.assertEqual(clean_code("```python\nprint(1)\n```"), "print(1)\n")
        self.assertEqual(
            normalized_hash("print(1) # comment\n"), normalized_hash("print ( 1 )\n")
        )
        self.assertEqual(len(normalized_hash("def broken(:")), 64)

    def test_splits_are_reproducible_and_group_disjoint(self):
        splits, _ = make_splits(synthetic_records())
        self.assertEqual(splits, make_splits(synthetic_records())[0])
        for left, right in (
            ("train", "validation"),
            ("train", "test_seen"),
            ("validation", "test_unseen"),
        ):
            self.assertFalse(
                {r["problem_id"] for r in splits[left]}
                & {r["problem_id"] for r in splits[right]}
            )
        self.assertNotIn(
            "LLAMA", {r["generator"] for r in splits["train"] + splits["validation"]}
        )
        self.assertEqual(
            {r["generator"] for r in splits["test_unseen"]}, {"HUMAN", "LLAMA"}
        )

    def test_conflicting_labels_removed(self):
        rows = synthetic_records()
        conflict = dict(rows[0], record_id="conflict", label=1, generator="GEMINI")
        splits, audit = make_splits(rows + [conflict])
        self.assertEqual(audit["conflicting_provenance_rows_removed"], 2)
        self.assertNotIn(
            rows[0]["normalized_hash"],
            {r["normalized_hash"] for part in splits.values() for r in part},
        )

    def test_duplicates_link_problem_groups(self):
        rows = synthetic_records()
        rows.append(dict(rows[0], problem_id="p99", record_id="linked"))
        splits, audit = make_splits(rows)
        self.assertEqual(audit["independent_groups"], 99)
        partitions = {}
        for s, rs in splits.items():
            for r in rs:
                partitions[r["problem_id"]] = "test" if s.startswith("test") else s
        self.assertEqual(partitions["p0"], partitions["p99"])

    def test_hybrid_excluded_and_labels_validated(self):
        import csv

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fields = [
                "problem_id",
                "submission_id",
                "LLM",
                "status_in_folder",
                "code",
                "label",
            ]
            for file, rows in [
                (
                    "human_selected_dataset.csv",
                    [["p1", "s1", "Human", "Accepted", "print(1)", 0]],
                ),
                (
                    "created_dataset_with_llms.csv",
                    [
                        ["p1", "s1", "GEMINI", "Runtime", "print(2)", 1],
                        ["p1", "unrelated", "GEMINI", "Generate", "print(3)", 1],
                    ],
                ),
            ]:
                with (root / file).open("w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(fields)
                    writer.writerows(rows)
            records, excluded = read_sources(root)
            self.assertEqual(len(records), 2)
            self.assertEqual(excluded["ai_repair_or_hybrid"], 1)

    def test_fpr_and_abstention(self):
        result = binary_metrics([0, 0, 1, 1], [0.1, 0.8, 0.4, 0.9])
        self.assertEqual(result["confusion_matrix"], [[1, 1], [1, 1]])
        self.assertEqual(result["human_false_positive_rate"], 0.5)
        self.assertGreater(wilson_upper(0, 20), 0)
        self.assertEqual(
            abstention_metrics([0, 0, 1, 1], [0.1, 0.8, 0.4, 0.9])["inconclusive_rate"],
            0.25,
        )

    def test_threshold_can_abstain_from_all_flags(self):
        selected = select_threshold([0, 1], [1.0, 0.5])
        self.assertGreater(selected["threshold"], 1.0)
        self.assertEqual(selected["recall_ai"], 0.0)

    def test_threshold_rejects_invalid_inputs(self):
        for labels, scores in (
            ([0, 1], [float("nan"), 0.2]),
            ([0], [0.3]),
            ([0, 1], [0.2]),
        ):
            with self.assertRaises(ValueError):
                select_threshold(labels, scores)


if __name__ == "__main__":
    unittest.main()
