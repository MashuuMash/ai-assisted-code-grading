"""Build a self-contained Kaggle notebook from the reviewed scripts, no remote code fetch."""

import json
from pathlib import Path


def build():
    root = Path(__file__).resolve().parent
    cells = []

    def md(text):
        cells.append(
            {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(True)}
        )

    def code(text):
        cells.append(
            {
                "cell_type": "code",
                "metadata": {},
                "source": text.splitlines(True),
                "execution_count": None,
                "outputs": [],
            }
        )

    md("""# CodeBERT AI detector — thử nghiệm nguồn tạo code Python

Đây KHÔNG phải notebook so sánh hai bài. Nhãn 0=human, 1=ai_generated.
Chọn **Settings → Accelerator → GPU**, bật **Internet**, rồi **Run All**.
Không cần API key, không tạo mã AI qua dịch vụ trả phí, không upload bài sinh viên.

Nguồn: [AIGCodeSet](https://huggingface.co/datasets/basakdemirok/AIGCodeSet),
revision b4d4e69fdbcba2608c99808c6afbf53a3bfd108c, giấy phép dataset theo publisher: CDLA-Permissive-2.0.
Trích dẫn Demirok & Kutlu, SIU 2025, arXiv:2412.16594; giữ DATASET_CARD.md khi chia sẻ kết quả.

Chỉ dùng AI `Generate`; bỏ AI sửa bài người. Chia theo nhóm đề, loại trùng token,
giữ LLAMA ngoài train/validation. Hai tập test dùng CHUNG mẫu người — không cộng gộp.
Một lần chạy, một seed chưa đủ để tuyên bố độ tin cậy. Không dùng kết quả để tự trừ điểm.
""")
    code(
        '%pip install -q "torch>=2.6,<3" "transformers==4.57.1" "scikit-learn>=1.5,<2" "numpy>=1.26,<3" "safetensors>=0.4.3"\n'
    )
    code(
        'from pathlib import Path\nimport sys, json, time\nROOT = Path("/kaggle/working/ai_detector_experiment")\nROOT.mkdir(parents=True, exist_ok=True)\nsys.path.insert(0, str(ROOT))\n'
    )
    for name in ("prepare_data.py", "evaluation.py", "train.py", "test_pipeline.py"):
        code(
            f'(ROOT / {name!r}).write_text({(root / name).read_text(encoding="utf-8")!r}, encoding="utf-8")\n'
        )
    md(
        "## 1. Kiểm thử pipeline, tải dữ liệu công khai và kiểm tra chia tập\nDữ liệu chỉ được đọc dưới dạng văn bản; không chạy code trong dataset."
    )
    code(
        'import subprocess\nsubprocess.run([sys.executable, "-m", "unittest", "test_pipeline", "-v"], cwd=ROOT, check=True)\nfrom prepare_data import prepare\nDATA = ROOT / "data"\nreport = prepare(DATA, seed=42, heldout="LLAMA")\nprint(json.dumps(report, indent=2))\n'
    )
    md(
        "## 2. Fine-tune\nBatch 4, 3 epoch. Nếu GPU thiếu RAM: giảm BATCH_SIZE xuống 2. Không chỉnh tham số theo kết quả test; dùng validation. Mỗi lần chạy tạo thư mục riêng, không ghi đè checkpoint cũ."
    )
    code(
        'import torch\nassert torch.cuda.is_available(), "Hãy bật GPU trong Settings của Kaggle"\nprint(torch.cuda.get_device_name(0))\nEPOCHS, BATCH_SIZE, SEED = 3, 4, 42\nRUN = ROOT / ("run_" + time.strftime("%Y%m%d_%H%M%S"))\nsubprocess.run([sys.executable, str(ROOT/"train.py"), "--data", str(DATA), "--output", str(RUN), "--epochs", str(EPOCHS), "--batch-size", str(BATCH_SIZE), "--seed", str(SEED)], check=True)\n'
    )
    md(
        "## 3. Kết quả và tải về\nXem human_false_positive_rate cùng human_fpr_wilson95_upper, recall_ai, baseline và test_unseen. Ngưỡng chọn trên validation là nhị phân; backend hiện vẫn dùng 0.35/0.65 nên có báo cáo riêng. Không bật model vào demo trước khi review."
    )
    code(
        'metrics = json.loads((RUN/"metrics.json").read_text())\nprint(json.dumps(metrics, indent=2))\nimport shutil\nfrom IPython.display import FileLink, display\nRESULTS = ROOT / (RUN.name + "_reports")\nRESULTS.mkdir(exist_ok=True)\nfor path in RUN.iterdir():\n    if path.is_file() and path.suffix != ".zip":\n        shutil.copy2(path, RESULTS/path.name)\nshutil.copy2(DATA/"data_report.json", RESULTS/"data_report.json")\narchive = shutil.make_archive(str(RESULTS), "zip", root_dir=RESULTS)\ndisplay(FileLink(str(RUN/"ai_detector_model.zip")))\ndisplay(FileLink(archive))\nprint("Nếu FileLink không tải được, dùng tab Output của Kaggle.")\n'
    )
    notebook = {
        "nbformat": 4,
        "nbformat_minor": 5,
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3.11"},
        },
    }
    for index, cell in enumerate(cells):
        cell["id"] = f"cell-{index:02d}"
    destination = root / "kaggle_ai_detector.ipynb"
    destination.write_text(
        json.dumps(notebook, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(destination)


if __name__ == "__main__":
    build()
