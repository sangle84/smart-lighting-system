# Workflow Checklist for Task Start

> File này cung cấp checklist ngắn để bắt đầu một task theo đúng role và branch của nhóm.  
> Mục tiêu: tránh làm việc trên `main`, tránh làm trên snapshot cũ, và giữ rõ ownership giữa `Sang` và `Thinh`.

## Checklist bắt đầu task

### 1. Xác định role hiện tại
- Kiểm tra branch hiện tại.
- Nếu branch bắt đầu bằng `Sang/` => role mặc định là `Sang`.
- Nếu branch bắt đầu bằng `Thinh/` => role mặc định là `Thinh`.
- Nếu branch đang ở `main` hoặc không khớp định dạng, phải tạo branch mới trước khi code.

### 2. Tạo branch nếu cần
- Không code trực tiếp lên `main`.
- Chỉ dùng 2 nhánh chính của nhóm: `Sang` và `Thinh`.
- Không tạo nhánh con dưới dạng `Sang/<task-name>` hoặc `Thinh/<task-name>`.
- Nếu đang ở `main`, tạo nhánh mới với tên `Sang` hoặc `Thinh` rồi bắt đầu làm việc.
- Mỗi người làm việc trên nhánh riêng của mình.

### 3. Pull code mới nhất
- Trước khi bắt đầu task, cập nhật branch hiện tại bằng `git pull` hoặc `git fetch` + `git rebase` nếu cần.
- Không làm việc trên repo snapshot cũ và không bắt đầu từ code đã lỗi thời.

### 4. Đọc tài liệu cần thiết
- Đọc `AGENTS.md` đầu tiên.
- Đọc `docs/TEAM-RESPONSIBILITIES.md` để xác nhận ownership module.
- Đọc tài liệu kỹ thuật liên quan như:
  - `docs/API_SPEC.md`
  - `docs/DATABASE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRD.md`

### 5. Kiểm tra tình trạng repo
- Xác định file nào đang cần sửa.
- Kiểm tra code hiện có trước khi thay đổi.
- Không giả định module đã sẵn sàng hoặc đã đúng.

### 6. Thực hiện task tối thiểu
- Chỉ sửa phần liên quan trực tiếp.
- Không tự ý đổi architecture, API contract, schema hoặc MQTT contract nếu không có chỉ dẫn rõ ràng.
- Nếu task chạm sang module của người còn lại, cần review chéo trước khi merge.

### 7. Validate
- Chạy test/check phù hợp với phần đang sửa.
- Nếu thay đổi ảnh hưởng đến API/database/architecture, cập nhật tài liệu liên quan.
- Nếu chưa có bằng chứng thực tế, không đánh dấu `Done` trong `PLAN.md`.

### 8. Commit và bàn giao
- Commit local theo từng task logic.
- Push branch lên remote theo nhánh hiện tại (`Sang` hoặc `Thinh`) nếu cần chia sẻ hoặc review.
- Không push trực tiếp lên `main`.
- Trước khi push, kiểm tra commit message không có `Co-authored-by: Copilot`; không để Copilot xuất hiện trong GitHub Contributors.
- Gửi bằng chứng test và file chính đã sửa cho người review.

## Quick rule

`Branch đúng + pull latest + docs đúng + test đúng = workflow hợp lệ.`
