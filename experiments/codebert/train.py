"""Single-source authorship experiment. Never executes dataset code or modifies backend."""

import argparse
import hashlib
import importlib.metadata
import json
import platform
import random
import shutil
import time
from pathlib import Path

from evaluation import abstention_metrics, binary_metrics, select_threshold

MODEL = "microsoft/codebert-base"
MODEL_REVISION = "3b0952feddeffad0063f274080e3c23d75e7eb39"


def read_jsonl(path):
    return [
        json.loads(line)
        for line in Path(path).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def train(data_dir, output, epochs=3, batch_size=4, seed=42, allow_cpu=False):
    import numpy as np
    import torch
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import average_precision_score, roc_auc_score
    from torch.utils.data import DataLoader
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError(
            "Output must be empty; use a new run directory to preserve earlier results"
        )
    if not torch.cuda.is_available() and not allow_cpu:
        raise RuntimeError(
            "Enable Kaggle GPU. CPU training requires explicit --allow-cpu"
        )
    if epochs < 1 or batch_size < 1:
        raise ValueError("epochs and batch_size must be positive")
    output.mkdir(parents=True, exist_ok=True)
    started = time.time()
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    data = {
        s: read_jsonl(Path(data_dir) / f"{s}.jsonl")
        for s in ("train", "validation", "test_seen", "test_unseen")
    }
    manifest = json.loads(
        (Path(data_dir) / "data_report.json").read_text(encoding="utf-8")
    )
    for left, right in (
        ("train", "validation"),
        ("train", "test_seen"),
        ("train", "test_unseen"),
        ("validation", "test_seen"),
        ("validation", "test_unseen"),
    ):
        for field in ("group_id", "problem_id", "normalized_hash"):
            if {r[field] for r in data[left]} & {r[field] for r in data[right]}:
                raise ValueError(f"Leakage: {left}/{right}/{field}")
    if any(
        r["generator"] == manifest["heldout_generator"]
        for s in ("train", "validation")
        for r in data[s]
    ):
        raise ValueError("Held-out generator found in training or validation")

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL, revision=MODEL_REVISION, trust_remote_code=False
    )
    max_length = 512  # Same single-source truncation as the current backend.

    def collate(rows):
        encoded = tokenizer(
            [r["code"] for r in rows],
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        )
        return encoded, torch.tensor([r["label"] for r in rows], dtype=torch.long)

    loaders = {
        s: DataLoader(
            rows,
            batch_size=batch_size,
            shuffle=s == "train",
            num_workers=0,
            collate_fn=collate,
        )
        for s, rows in data.items()
    }
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL,
        revision=MODEL_REVISION,
        num_labels=2,
        trust_remote_code=False,
        id2label={0: "human", 1: "ai_generated"},
        label2id={"human": 0, "ai_generated": 1},
    ).to(device)
    model.config.ai_detector_task = "single_source_origin_classification"
    model.config.ai_detector_max_length = max_length
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
    counts = np.bincount([r["label"] for r in data["train"]], minlength=2)
    if min(counts) == 0:
        raise ValueError("Training data lacks a class")
    weights = torch.tensor(
        len(data["train"]) / (2 * counts), dtype=torch.float32, device=device
    )
    loss_fn = torch.nn.CrossEntropyLoss(weight=weights)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    @torch.no_grad()
    def predict(loader):
        model.eval()
        scores = []
        for features, _ in loader:
            logits = model(**{k: v.to(device) for k, v in features.items()}).logits
            scores.extend(torch.softmax(logits, dim=-1)[:, 1].cpu().tolist())
        return scores

    history, best_ap = [], -1.0
    best_dir = output / "best_model"
    for epoch in range(epochs):
        model.train()
        losses = []
        for index, (features, labels) in enumerate(loaders["train"]):
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(
                device_type=device.type,
                dtype=torch.float16,
                enabled=device.type == "cuda",
            ):
                logits = model(**{k: v.to(device) for k, v in features.items()}).logits
                loss = loss_fn(logits, labels.to(device))
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()
            losses.append(loss.item())
            if index % 100 == 0:
                print(
                    f"epoch={epoch + 1} batch={index}/{len(loaders['train'])} loss={loss.item():.4f}",
                    flush=True,
                )
        val_prob = predict(loaders["validation"])
        labels = [r["label"] for r in data["validation"]]
        ap = float(average_precision_score(labels, val_prob))
        row = {
            "epoch": epoch + 1,
            "train_loss": float(np.mean(losses)),
            "validation_average_precision": ap,
            "validation_at_05": binary_metrics(labels, val_prob),
        }
        history.append(row)
        print(json.dumps(row), flush=True)
        if ap > best_ap:
            best_ap = ap
            model.save_pretrained(best_dir, safe_serialization=True)
            tokenizer.save_pretrained(best_dir)
        (output / "history.json").write_text(
            json.dumps(history, indent=2), encoding="utf-8"
        )

    del optimizer, scaler, model
    if device.type == "cuda":
        torch.cuda.empty_cache()
    model = AutoModelForSequenceClassification.from_pretrained(
        best_dir, local_files_only=True
    ).to(device)
    val_prob = predict(loaders["validation"])
    val_labels = [r["label"] for r in data["validation"]]
    chosen = select_threshold(val_labels, val_prob, max_fpr=0.01)

    # Baseline trained on identical rows, never fit on validation/test.
    vectorizer = TfidfVectorizer(
        analyzer="char", ngram_range=(3, 5), max_features=30000, min_df=2
    )
    baseline = LogisticRegression(
        class_weight="balanced", max_iter=1000, random_state=seed
    )
    baseline.fit(
        vectorizer.fit_transform([r["code"] for r in data["train"]]),
        [r["label"] for r in data["train"]],
    )
    baseline_val = baseline.predict_proba(
        vectorizer.transform([r["code"] for r in data["validation"]])
    )[:, 1].tolist()
    baseline_threshold = select_threshold(val_labels, baseline_val)["threshold"]

    def report(rows, scores, threshold):
        labels = [r["label"] for r in rows]
        return {
            "binary_at_05": binary_metrics(labels, scores),
            "validation_selected_threshold": binary_metrics(labels, scores, threshold),
            "current_backend_035_065": abstention_metrics(labels, scores),
            "average_precision": float(average_precision_score(labels, scores)),
            "roc_auc": float(roc_auc_score(labels, scores)),
        }

    results = {
        "validation_selection": chosen,
        "codebert": {},
        "tfidf_logistic": {},
        "per_generator": {},
    }
    for split in ("validation", "test_seen", "test_unseen"):
        rows = data[split]
        prob = val_prob if split == "validation" else predict(loaders[split])
        results["codebert"][split] = report(rows, prob, chosen["threshold"])
        base_prob = baseline.predict_proba(
            vectorizer.transform([r["code"] for r in rows])
        )[:, 1].tolist()
        results["tfidf_logistic"][split] = report(rows, base_prob, baseline_threshold)
        generators = sorted({r["generator"] for r in rows if r["label"] == 1})
        results["per_generator"][split] = {}
        for generator in generators:
            indices = [
                i
                for i, r in enumerate(rows)
                if r["label"] == 0 or r["generator"] == generator
            ]
            results["per_generator"][split][generator] = report(
                [rows[i] for i in indices],
                [prob[i] for i in indices],
                chosen["threshold"],
            )
        predictions = [
            {
                "record_id": r["record_id"],
                "problem_id": r["problem_id"],
                "label": r["label"],
                "generator": r["generator"],
                "ai_score": p,
                "prediction": int(p >= chosen["threshold"]),
                "truncated": len(tokenizer.encode(r["code"], truncation=False))
                > max_length,
            }
            for r, p in zip(rows, prob)
        ]
        (output / f"{split}_predictions.jsonl").write_text(
            "".join(json.dumps(r) + "\n" for r in predictions), encoding="utf-8"
        )
        results["codebert"][split]["truncated_rows"] = sum(
            r["truncated"] for r in predictions
        )
    metadata = {
        "model": MODEL,
        "model_revision": MODEL_REVISION,
        "seed": seed,
        "epochs": epochs,
        "batch_size": batch_size,
        "max_length": max_length,
        "learning_rate": 2e-5,
        "python": platform.python_version(),
        "device": str(device),
        "gpu": torch.cuda.get_device_name() if device.type == "cuda" else None,
        "packages": {
            p: importlib.metadata.version(p)
            for p in ("torch", "transformers", "scikit-learn", "numpy")
        },
        "data_report": manifest,
        "seconds": time.time() - started,
        "split_sha256": {
            s: hashlib.sha256((Path(data_dir) / f"{s}.jsonl").read_bytes()).hexdigest()
            for s in data
        },
        "limitations": [
            "Scores are not calibrated probabilities of authorship",
            "1% empirical validation FPR is not a deployment guarantee; inspect confidence bound",
            "Backend still uses 0.35/0.65; selected binary threshold is evaluation only",
            "No deployment approval; no penalty or academic misconduct decision from this signal",
        ],
    }
    (output / "metrics.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )
    (output / "run_manifest.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    # A self-contained offline-loadable model. Metrics intentionally outside model directory.
    model.cpu()
    model.save_pretrained(best_dir, safe_serialization=True)
    shutil.copy2(Path(data_dir) / "raw" / "README.md", output / "DATASET_CARD.md")
    archive = Path(
        shutil.make_archive(str(output / "ai_detector_model"), "zip", root_dir=best_dir)
    )
    (output / "model_sha256.txt").write_text(
        hashlib.sha256(archive.read_bytes()).hexdigest() + "\n", encoding="utf-8"
    )
    print(
        f"Finished. Inspect {output / 'metrics.json'} BEFORE integrating the checkpoint."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-cpu", action="store_true")
    args = parser.parse_args()
    train(
        args.data, args.output, args.epochs, args.batch_size, args.seed, args.allow_cpu
    )
