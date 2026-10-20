# CodeBERT phân loại nguồn tạo mã Python — thử nghiệm v1

## Trạng thái bàn giao (14/10/2026)

- Đã tải và kiểm tra schema/checksum của dữ liệu thật; đã chạy bước lọc/chia tập.
- Có notebook Kaggle tự chứa code, không cần clone repo hoặc API key.
- Đã có unit test cho chia nhóm, chống trùng, loại dữ liệu hybrid, tính FPR và ngưỡng.
- **Chưa chạy fine-tune GPU. Chưa có checkpoint đã huấn luyện hoặc accuracy/F1 thực nghiệm.**
- Không thay đổi backend, JPlag, rubric, dữ liệu demo hoặc tự bật detector mới.

## Bắt đầu trên Kaggle

1. Tạo notebook mới → dùng chức năng Import/Upload notebook, chọn `kaggle_ai_detector.ipynb` trong thư mục này.
2. Bật Internet và GPU trong Settings. Notebook kiểm tra GPU trước khi train.
3. Chọn Run All. Không cần tìm dataset thủ công: notebook tải đúng hai CSV công khai với revision và checksum cố định.
4. Nếu thiếu bộ nhớ GPU, giảm `BATCH_SIZE` từ 4 xuống 2 rồi chạy lại phần train; không chỉnh tham số để tối ưu trên test.
5. Sau khi chạy xong, tải `ai_detector_model.zip` và gói `run_..._reports.zip` ở cuối notebook hoặc tab Output. Gửi gói reports trước để review; chưa cần gửi model lớn.

Phần train có 3 epoch, báo tiến độ mỗi 100 batch. Không cam kết thời gian chạy: phụ thuộc GPU và độ dài code. Nếu cài thư viện yêu cầu restart kernel, restart rồi Run All.

Notebook được tạo từ script bằng `python experiments/codebert/build_notebook.py`. Khi sửa script phải tạo lại notebook; không chỉ sửa một bản rồi giao bản kia.

## Đúng bài toán, không phải clone detection

- Đầu vào model: **một chuỗi code**, không có metadata, problem ID, tên LLM hoặc label trong chuỗi.
- Nhãn model: `id2label = {0: "human", 1: "ai_generated"}`.
- Fine-tune `microsoft/codebert-base`, revision `3b0952feddeffad0063f274080e3c23d75e7eb39`.
- Chọn checkpoint bằng average precision trên validation. Test chỉ chạy sau khi chọn checkpoint/ngưỡng.
- Lưu safetensors và tokenizer để nạp offline. Không có quyền tự kết luận gian lận hoặc tự trừ điểm.

## Nguồn dữ liệu và giấy phép

Nguồn chính thức: [AIGCodeSet](https://huggingface.co/datasets/basakdemirok/AIGCodeSet).
Revision: `b4d4e69fdbcba2608c99808c6afbf53a3bfd108c`.

Theo dataset card, code người có nguồn CodeNet; các nguồn AI là GEMINI, CODESTRAL, LLAMA.
Publisher công bố dataset theo **CDLA Permissive 2.0**, code đi kèm theo Apache 2.0.
Giữ bản `DATASET_CARD.md` và ghi công nguồn khi chia sẻ. Không suy diễn giấy phép của toàn repo sang dữ liệu khác.

Trích dẫn: Demirok, Basak & Kutlu, Mucahid (2025), *AIGCodeSet: A New Annotated Dataset for AI Generated Code Detection*, SIU 2025. [Preprint](https://arxiv.org/abs/2412.16594).

Không dùng dữ liệu sinh viên riêng tư, không gọi API sinh code trả phí. Không đưa CSV/checkpoint lên Git. Script chỉ đọc code như văn bản, không `exec` hoặc chạy các bài tải về.

## Cách xử lý và chống rò rỉ

1. Kiểm tra schema, nhãn, nguồn, checksum. Chỉ giữ AI có `status_in_folder=Generate`; bỏ các trường hợp AI sửa code người (`Runtime`, `Wrong`). Đây là nhãn theo publisher, không phải xác nhận độc lập.
2. Bỏ fence Markdown bao trọn đầu ra theo cùng quy tắc cho hai nhãn. Giữ comment/docstring; không loại riêng code người bị lỗi cú pháp.
3. Loại cặp code trùng token nhưng nhãn trái ngược. Gộp các đề có code trùng token thành nhóm liên thông, giữ một mẫu trên mỗi hash cùng nhãn.
4. Chia nhóm đề 65% train, 15% validation, 20% test với seed 42. LLAMA bị loại hoàn toàn khỏi train/validation.
5. `test_seen`: đề mới, GEMINI/CODESTRAL + người. `test_unseen`: đề mới, LLAMA + người. **Hai tập dùng chung người đối chứng; không cộng kích thước hay xem như hai thí nghiệm độc lập.**
6. Dữ liệu lệch lớp: dùng class-weighted loss; không làm cân bằng test để che tỷ lệ thực.

Kết quả bước chuẩn bị đã chạy cục bộ:

| Tập | Người | AI | Tổng |
|---|---:|---:|---:|
| Train | 3.071 | 395 | 3.466 |
| Validation | 704 | 92 | 796 |
| Test nguồn đã gặp | 946 | 122 | 1.068 |
| Test LLAMA chưa gặp | 946 | 62 | 1.008 |

Loại 1.887 mẫu AI sửa code/hybrid, 38 dòng trùng có nhãn mâu thuẫn, 18 dòng trùng cùng nhãn; giữ 317 nhóm đề độc lập theo quy tắc hash. Tập AI thuần nhỏ: đây là thí nghiệm khởi đầu, không phải bộ huấn luyện đủ đại diện mọi LLM.

## Đọc kết quả

- `metrics.json`: accuracy, precision/recall/F1 AI, confusion matrix, ROC-AUC, average precision, FPR trên người và cận trên Wilson 95% của FPR.
- Ngưỡng nhị phân chọn trên validation với mục tiêu **FPR thực nghiệm ≤1%**, ưu tiên recall, tie-break về FPR thấp/ngưỡng cao. Nếu không có ngưỡng hữu ích, có thể không gắn cờ mẫu nào; recall=0 phải được báo trung thực.
- Cận Wilson không điều chỉnh việc tìm ngưỡng trên validation. Cần đọc kết quả test chưa dùng chọn ngưỡng và thừa nhận tương quan trong cùng đề; khoảng tin cậy trên từng dòng không thay thế bootstrap theo đề.
- Báo thêm tỷ lệ `inconclusive` theo **ngưỡng backend hiện có 0.35/0.65**. Ngưỡng nhị phân đã chọn KHÔNG tự thay thế hai ngưỡng backend.
- Baseline TF-IDF + logistic regression dùng cùng train/validation/test. So cả FPR và recall, không chỉ accuracy (tập test lệch mạnh về người).
- Có báo cáo theo generator và cờ `truncated` trong predictions; mã dài bị cắt ở 512 token như backend hiện tại.
- `run_manifest.json`: revision dữ liệu/model, checksum split, phiên bản thư viện, seed, cấu hình, thiết bị, thời gian.

Trước tích hợp: đọc các false-positive (tra `record_id` trong data JSONL), thử thêm code người thật có quyền sử dụng, code được format lại, AI mới và code trộn người/AI. Không thay test nhiều lần rồi tiếp tục gọi nó là test độc lập.

## Giới hạn bắt buộc ghi trong báo cáo

- Nhãn nguồn do dataset cung cấp, không phải chứng cứ chắc chắn về tác giả.
- Chưa tách theo tác giả, chưa kiểm tra dữ liệu trùng với pretraining của CodeBERT, chưa chống mọi near-duplicate ngữ nghĩa.
- Code người có cả bài lỗi; có thể tồn tại tín hiệu nhiễu về độ đúng, format, độ dài, comment. Cần thêm đánh giá đối chứng, không coi việc chia theo đề đã loại hết bias.
- Chưa đánh giá code hybrid, AI được người chỉnh lại, ngoài Python hoặc các LLM mới.
- Softmax score chưa được hiệu chỉnh xác suất; không diễn giải “0.9” thành “chắc chắn 90% sinh viên dùng AI”.
- Một seed, dataset nhỏ và 62 mẫu AI unseen không đủ để tuyên bố khả năng tổng quát hóa.

## Chạy cục bộ trong môi trường huấn luyện riêng

Không cài các thư viện GPU vào `.venv` backend chỉ để chạy thử. Dùng Python 3.11/3.12 và môi trường riêng, cài PyTorch phù hợp GPU theo hướng dẫn chính thức, rồi dependencies trong `requirements.txt`.

```powershell
python experiments/codebert/prepare_data.py
python -m unittest discover -s experiments/codebert -p test_pipeline.py -v
python experiments/codebert/train.py --data experiments/codebert/data/aigcodeset --output experiments/codebert/checkpoints/run_01
```

Output phải trống để không ghi đè thí nghiệm cũ. GPU được yêu cầu mặc định; `--allow-cpu` chỉ dùng khi chủ động chấp nhận thời gian huấn luyện CPU.

## Tích hợp sau khi review

Checkpoint xuất đúng tên nhãn và đầu vào của `backend/app/codebert_detector.py`. Tuy vậy backend hiện không cài torch/transformers trong image và không đọc ngưỡng chọn mới: **copy model vào thư mục chưa đủ để bật detector**.

Sau khi review metrics cần cấu hình dependency/mount model, `AI_DETECTOR_MODEL_PATH`, ngưỡng phù hợp và kiểm thử `model_mode=transformers_codebert` (không fallback heuristic). Đó là bước tích hợp riêng, chưa thực hiện trong lần chuẩn bị notebook này.
