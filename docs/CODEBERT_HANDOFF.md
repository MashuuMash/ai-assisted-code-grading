# Giao việc fine-tune CodeBERT cho thành viên nhóm

## 0. Đồng bộ mã trước khi clone

Các thay đổi tích hợp CodeBERT hiện tại có thể còn **chưa commit/push**. Người phụ trách chính cần kiểm tra `git status`, commit và push một nhánh tích hợp ổn định trước; sau đó gửi đúng URL repo + tên nhánh hoặc commit hash. `git clone` từ remote không lấy được thay đổi chưa commit trên máy người khác. Không đưa `.env`, API key, dữ liệu cá nhân hoặc checkpoint lớn vào commit.

Người làm CodeBERT tạo nhánh riêng từ commit được giao, ví dụ `feature/codebert-finetune`. Không sửa đồng thời luồng chấm bài, migration, JPlag hoặc UI nếu chưa thống nhất với người tích hợp.

## 1. Mục tiêu và ranh giới

Mục tiêu là **thử nghiệm phân loại mã Python theo nguồn tạo** (`human` / `ai_generated`) bằng một checkpoint CodeBERT đã fine-tune. Đây là tín hiệu hỗ trợ giảng viên xem xét, **không phải chứng cứ chắc chắn về tác giả hoặc gian lận**. Bài toán này tách khỏi chức năng chấm đúng/sai bằng test và rubric.

Phần phụ trách của bạn:

- Dữ liệu có nguồn và nhãn đáng tin; quy trình làm sạch, chia tập, huấn luyện và đánh giá.
- Script huấn luyện, script đánh giá, dependencies và tài liệu tái lập thí nghiệm.
- Checkpoint có thể được nạp bằng giao diện hiện có, cùng báo cáo kết quả và các trường hợp thất bại.

Ưu tiên đặt mã mới trong `experiments/codebert/` (tạo thư mục nếu cần). Chỉ chỉnh `backend/app/codebert_detector.py`, `backend/requirements.txt`, `backend/Dockerfile` hoặc `docker-compose.yml` khi thật sự cần tích hợp runtime; báo trước người tích hợp vì các file này đang được sửa ở nhánh chính. Không đưa dữ liệu gốc hoặc trọng số mô hình vào Git; bàn giao checkpoint qua đường dẫn/chia sẻ nội bộ và checksum SHA256.

## 2. Hợp đồng checkpoint của ứng dụng hiện tại

Ứng dụng đọc `AI_DETECTOR_MODEL_PATH` trong `backend/app/config.py`. `CodeBertDetector` tại `backend/app/codebert_detector.py` chỉ nạp **thư mục checkpoint local** bằng `AutoTokenizer.from_pretrained(..., local_files_only=True)` và `AutoModelForSequenceClassification.from_pretrained(..., local_files_only=True)`. Vì vậy thư mục bàn giao phải chứa tokenizer, `config.json`, trọng số model và các tệp cần thiết do `save_pretrained()` tạo ra. Không bàn giao mỗi tệp `.pt` hoặc tên model trên Hugging Face Hub.

`config.json` phải có đúng hai nhãn `human` và `ai_generated` trong `id2label` (không phụ thuộc thứ tự). Ví dụ:

```json
{"id2label": {"0": "human", "1": "ai_generated"}, "label2id": {"human": 0, "ai_generated": 1}}
```

Khi model nạp thành công, API trả `model_mode=transformers_codebert`; nếu thiếu checkpoint, dependencies hoặc lỗi suy luận, hiện tại hệ thống sẽ dùng `model_mode=heuristic_statistical` và kết luận `inconclusive`. **Phải kiểm tra `model_mode` khi báo cáo kết quả; không tính điểm heuristic thành kết quả của checkpoint.** Ngưỡng hiện tại trong ứng dụng: `P(AI) >= 0.65` là `ai_generated`, `<= 0.35` là `human`, còn lại `inconclusive`; các ngưỡng này chưa được hiệu chỉnh bằng dữ liệu thật.

Runtime Docker hiện **chưa cài `torch`/`transformers`** và chưa mount thư mục checkpoint. Đây là việc tích hợp riêng sau khi có mô hình đạt yêu cầu; không chỉ đặt `AI_DETECTOR_MODEL_PATH` rồi cho rằng Docker đã chạy model. Có thể kiểm tra checkpoint ở môi trường huấn luyện trước. Khi tích hợp Compose, cần thêm dependencies và mount checkpoint đọc-only hoặc đóng gói phù hợp, rồi xác nhận API thật trả đúng `model_mode`.

## 3. Dữ liệu và thí nghiệm tối thiểu

1. Ghi lại nguồn, giấy phép/quyền sử dụng, cách tạo nhãn và số mẫu của từng nguồn. Mã công khai không đương nhiên có nhãn `human` đáng tin; mã do mô hình tạo phải ghi model, phiên bản/cấu hình, prompt và thời điểm tạo.
2. Chỉ dùng mã Python; loại thông tin cá nhân, trùng lặp và bài quá ngắn/rỗng. Không đưa dữ liệu riêng của sinh viên lên dịch vụ công cộng nếu chưa có phép.
3. Chia **train/validation/test theo đề bài hoặc nguồn**, không chia ngẫu nhiên các biến thể gần giống của cùng lời giải sang nhiều tập. Giữ test set chưa xem khi chọn ngưỡng/siêu tham số. Nếu có nhiều nguồn AI, dành ít nhất một nguồn/model chưa thấy để thử khả năng tổng quát hóa.
4. Huấn luyện `microsoft/codebert-base` với classification head hai nhãn. Ghi seed, số epoch, batch size, learning rate, max length, phiên bản package, phần cứng, thời gian huấn luyện. Lưu `model.save_pretrained()` và `tokenizer.save_pretrained()`.
5. Đánh giá trên test set: confusion matrix, precision/recall/F1 cho từng lớp, đặc biệt **false positive trên mã người viết**; báo thêm tỷ lệ `inconclusive` theo ngưỡng 0.35/0.65. So với baseline đơn giản và thử mã được đổi tên biến/định dạng. Không chỉ báo accuracy.
6. Phân tích ít nhất vài trường hợp đoán sai và giới hạn của dữ liệu. Nếu tập nhỏ hoặc lệch nguồn, ghi rõ là kết quả thăm dò, không khẳng định dùng được để xử lý kỷ luật.

Lưu ý: `scripts/generate_ai_code_dataset.py` tạo dữ liệu **tổng hợp**; `scripts/evaluate_codebert.py` hiện tự tạo bộ này nếu thiếu tệp và dùng ngưỡng 0.50. **Không dùng kết quả mặc định đó làm chứng cứ cho checkpoint fine-tune hoặc so trực tiếp với ngưỡng 0.35/0.65 của sản phẩm.** Hãy tạo script đánh giá riêng dùng tập test độc lập và ghi rõ checkpoint được nạp.

## 4. Tiêu chí bàn giao cho người tích hợp

- Nhánh/PR chỉ chứa mã, cấu hình và tài liệu cần thiết; không chứa dữ liệu nhạy cảm hoặc checkpoint lớn.
- Tài liệu `experiments/codebert/README.md`: nguồn dữ liệu, số lượng từng nhãn/tập, cách chạy train/eval, phụ thuộc, seed, giới hạn và giấy phép.
- Checkpoint local nạp được offline, nhãn đúng, cùng SHA256 của gói bàn giao.
- `metrics.json` và mô tả cách tính: confusion matrix, precision/recall/F1, false-positive rate, tỷ lệ inconclusive, kích thước test set và kết quả thử nguồn/model chưa thấy (nếu có).
- Một ví dụ lệnh nạp checkpoint và dự đoán cho tệp Python mới; đầu ra phải có `model_mode=transformers_codebert`.
- Test nhỏ chứng minh nhãn `ai_generated` được đọc đúng dù vị trí nhãn là 0 hoặc 1, và model không rơi về heuristic âm thầm.

Người tích hợp sẽ review kết quả trước khi bật checkpoint trong demo. Nếu không đạt hoặc chưa có test set đáng tin, giữ tính năng ở mức **thử nghiệm, không dùng để kết luận AI authorship**.
