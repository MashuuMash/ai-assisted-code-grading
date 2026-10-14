# AI-assisted code grading

Ứng dụng hỗ trợ giảng viên nhận bài Python, chạy test trong Docker, lưu minh chứng chấm điểm, xem tín hiệu tương đồng mã và xuất bảng điểm CSV. Phần phát hiện mã do AI tạo chỉ là **tín hiệu thử nghiệm**, không phải kết luận về tác giả.

## Chạy trên Windows với Docker Desktop

1. Khởi động Docker Desktop. Cài JPlag 6.2.0 (tùy chọn) bằng PowerShell: `./scripts/setup_jplag.ps1`. Script kiểm tra SHA256 của JAR tải từ trang phát hành chính thức. Nếu không cài JPlag, hệ thống dùng bộ so sánh token winnowing và hiển thị rõ engine trong báo cáo.
2. Chạy `docker compose up --build -d`. API ở `http://localhost:8000`, tài liệu API ở `http://localhost:8000/docs`.
3. Trong thư mục `frontend`, chạy `npm ci` rồi `npm run dev` để mở giao diện Vite.

Compose dùng PostgreSQL 16 và tự áp dụng migration khi backend khởi động. **Không xóa volume PostgreSQL cũ để sửa lỗi khởi động.** Nếu volume đã được tạo bởi PostgreSQL 15, hãy sao lưu và nâng cấp dữ liệu đúng quy trình, hoặc dùng tên Compose project riêng cho một môi trường thử nghiệm trống (ví dụ `docker compose -p grading_demo up --build -d`). Tên project riêng tạo volume riêng, không chuyển dữ liệu cũ sang.

Để thử luồng tích hợp trên **môi trường dùng một lần** (script sẽ tạo tài khoản, lớp, bài tập và bài nộp trong database):

```powershell
docker compose -p grading_demo exec -e SMOKE_ALLOW_WRITE=1 backend python smoke_compose.py
```

Script smoke hiện yêu cầu JPlag và xác nhận báo cáo thực sự do JPlag tạo. Không chạy script này trên database thật.
Sau khi script báo `PASS`, nó in tên đăng nhập và mật khẩu ngẫu nhiên của giảng viên demo; dùng thông tin đó tại `http://localhost:3000`. Nút/tài khoản `lecturer` trong các bản cũ chỉ tồn tại trong test, không được tự tạo bởi Compose. Không chia sẻ hoặc dùng lại mật khẩu demo bên ngoài máy thử nghiệm.

Trên giao diện, tab **Set Up Course & Class** cho phép tạo môn, lớp và bài tập. Sau khi tạo bài tập, mở tab **Rubric & Formulas** để tạo rubric mẫu hoặc rubric riêng; có thể chỉnh tiêu chí và trọng số trước khi bắt đầu chấm. Khi bài đã có điểm, hệ thống chặn thay đổi tiêu chí/điểm tối đa để bảo toàn điểm đã lưu.

Tab **Assignment & Tests** cho phép sửa đề, hướng dẫn, starter code, trạng thái, hạn nộp và thêm/sửa/xóa test public/hidden. Test đã có kết quả không được xóa hoặc đổi visibility để giữ lịch sử; có thể sửa nội dung rồi chấm lại. Trong tab chấm bài, **Rerun grading** tạo lượt chấm mới, giữ lịch sử và đưa điểm về draft để giảng viên duyệt lại. Khi lượt chấm còn chạy, hệ thống chặn lưu/xác nhận điểm.

Backend đợi database sẵn sàng trước khi chạy migration. PostgreSQL chỉ mở trong mạng Compose; API mặc định chỉ bind localhost. Đặt `$env:BACKEND_PORT = '8001'` nếu cần một stack thử nghiệm riêng chạy song song. Backend không còn tự reload; sau sửa Python, chạy `docker compose -p grading_demo restart backend worker`.

## Kiểm thử

```powershell
docker build -t grading-sandbox:latest ./sandbox
cd backend
$env:DEBUG = 'false'
../.venv/Scripts/python.exe -m pytest -q
../.venv/Scripts/python.exe -m ruff check .
cd ../frontend
npm ci
npm run build
npm run lint
```

Kiểm thử trình duyệt thật bằng Playwright (tự sinh ZIP mẫu, tạo môn/lớp/bài mới; chỉ dùng database thử nghiệm):

```powershell
# Từ thư mục gốc: khởi động stack riêng trên cổng 8001
$env:BACKEND_PORT = '8001'
docker compose -p grading_e2e up --build -d
docker compose -p grading_e2e exec -e SMOKE_ALLOW_WRITE=1 backend python smoke_compose.py
cd frontend
npx playwright install chromium
$env:E2E_USERNAME = '<username từ smoke test>'
$env:E2E_PASSWORD = '<password từ smoke test>'
npm run test:e2e
Remove-Item Env:E2E_PASSWORD
Remove-Item Env:BACKEND_PORT
```

Playwright tự mở Vite trên cổng 3001, nối API 8001, kiểm tra đăng nhập → tạo workspace → sửa đề/test → nhập ZIP → chấm/xác nhận → đổi test/chấm lại → xuất CSV. Ảnh nằm tại `frontend/test-results/workstation-success.png`; khi lỗi có screenshot và trace. Không đưa thư mục test-results hay mật khẩu vào Git. Kiểm thử này chưa thay thế đánh giá bằng bài sinh viên thật.

Các bài test tích hợp Docker/JPlag tự bỏ qua nếu thiếu Docker image hoặc JAR. Việc bỏ qua test không chứng minh hai tính năng đó đã hoạt động; hãy chạy smoke test trên Compose để xác nhận toàn luồng.

## Giới hạn cần trình bày trung thực

- Chưa có tập bài nộp thật hoặc đánh giá của giảng viên; các kết quả hiện tại là kiểm thử kỹ thuật trên dữ liệu mẫu, chưa phải chứng cứ về độ chính xác sư phạm.
- Chỉ cấu hình `AI_DETECTOR_MODEL_PATH` khi có checkpoint phân loại đã fine-tune với nhãn `human` và `ai_generated`. Không cần fine-tune CodeBERT để hoàn thiện luồng chấm bài chính. Khi chưa có mô hình hợp lệ, điểm phong cách AI chỉ là heuristic mang tính tham khảo.
- JPlag phát hiện tương đồng, không tự kết luận đạo văn. Giảng viên cần xem ngữ cảnh, đề bài và phần mã được đánh dấu.
