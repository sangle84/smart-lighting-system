# PROJECT-RULES — Smart Lighting System

> Đây là quy tắc dành cho AI coding agent khi thực hiện thay đổi code. File này **không** mô tả requirements (xem `PRD.md` cho requirements).

## 1. General Rules

- Không tự ý mở rộng scope (không thêm AI/ML, OTA, RGB, báo cháy, báo trộm, camera, mobile app riêng — xem `PRD.md` mục Out of Scope).
- Không tự ý thay đổi architecture đã mô tả trong `ARCHITECTURE.md` (ví dụ: không cho Frontend truy cập trực tiếp PostgreSQL hoặc MQTT Broker).
- Không xóa functionality hiện có trừ khi được yêu cầu rõ ràng.
- Ưu tiên thay đổi nhỏ và có kiểm soát; tránh refactor lớn không cần thiết cho task hiện tại.
- Kiểm tra code hiện tại trước khi sửa — không giả định code đã tồn tại hoặc đã hoạt động đúng.

## 2. Backend Rules

- Sử dụng **TypeScript** và **Express** đúng theo stack đã chọn (xem `ARCHITECTURE.md`).
- API structure phải tuân thủ đúng danh sách endpoint trong `API_SPEC.md`; không tự thêm/xóa endpoint.
- Validation: input phải được kiểm tra và làm sạch trước khi xử lý (theo yêu cầu bảo mật trong báo cáo gốc, mục 3.6.1).
- Error handling: cần có xử lý lỗi rõ ràng cho các API; dùng đúng format lỗi chuẩn `{code, message, details}` trong `API_SPEC.md` mục "Quy ước chung về lỗi và phạm vi truy cập". Không tự đổi format.
- Authentication: dùng JWT để xác thực API.
- Authorization: RBAC phải được kiểm tra **tại backend/API**, không chỉ ẩn phần tử trên giao diện.
- Authorization theo thiết bị: mọi truy vấn/endpoint liên quan thiết bị phải lọc theo `DEVICE_ACCESS` với Operator/Viewer (Admin: tất cả); không đủ quyền trả `404`. Thứ tự kiểm tra: 401 → 403 → 404 → 400 → 409.
- MQTT integration: dùng MQTT.js để giao tiếp với Mosquitto; topic và payload phải đúng theo `API_SPEC.md` Phần B.
- Database access: chỉ Backend được truy cập PostgreSQL trực tiếp; không cho phép Frontend hoặc thành phần khác truy cập DB.
- Logging: audit log cho các thao tác quan trọng phải được ghi vào bảng `AUDIT_LOG` (xem `DATABASE.md`), dùng đúng danh sách `action` trong `DATABASE.md` mục 10; không ghi mật khẩu, token hay `device_key` vào `description`.

## 3. Frontend Rules

- Sử dụng **React + TypeScript + Vite + Tailwind CSS** đúng theo stack đã chọn.
- API integration: Frontend chỉ giao tiếp với Backend qua REST/Socket.IO, không kết nối trực tiếp PostgreSQL hoặc MQTT Broker.
- Authentication state: **[ĐÃ BỔ SUNG]** Quản lý trạng thái đăng nhập/token ở phía client: lưu Access Token trong bộ nhớ ứng dụng (React Auth Context/State), lưu Refresh Token trong HttpOnly Cookie; header mọi request bảo vệ bằng `Authorization: Bearer <access_token>`. Khi Access Token hết hạn, client tự động gọi `POST /auth/refresh` để nhận token mới.
  - *Lý do/Rationale:* Đây là kiến trúc xác thực chuẩn để lập trình Http Client Interceptor (Axios/Fetch) và React Auth Guard, giúp bảo vệ token trước nguy cơ tấn công XSS (không lưu refresh token ở localStorage).
- RBAC UI: giao diện nên ẩn/hiện chức năng theo vai trò để trải nghiệm tốt hơn, **nhưng đây chỉ là UX**, không thay thế cho kiểm tra quyền ở backend.
- Realtime: dùng Socket.IO để nhận cập nhật dữ liệu thời gian thực (dashboard, trạng thái thiết bị, telemetry mới).
- Biểu đồ dùng Recharts (theo `ARCHITECTURE.md`).

## 4. Firmware Rules

- Nền tảng: ESP32, firmware viết bằng C++ với PlatformIO/Arduino Framework.
- Sensor handling: đọc dữ liệu từ BH1750 (lux), RCWL-0516 (motion), INA219 (voltage/current/power) theo đúng vai trò đã định nghĩa trong `ARCHITECTURE.md`.
- MQTT: publish telemetry lên `iot/device/{device_id}/telemetry`, publish heartbeat/status lên `iot/device/{device_id}/status`, subscribe `iot/device/{device_id}/command` và `iot/device/{device_id}/config`, publish ACK lên `iot/device/{device_id}/ack`. Không tự đổi cấu trúc topic.
- Reconnect: firmware phải tự động kết nối lại khi mất kết nối mạng/MQTT (yêu cầu reliability trong `PRD.md`).
- Heartbeat: gửi định kỳ để backend phát hiện `DEVICE_OFFLINE` khi timeout.
- Command handling: xử lý lệnh nhận từ topic `command`, áp dụng thay đổi (ví dụ PWM), sau đó gửi ACK.
- ACK: mọi lệnh nhận được phải có phản hồi ACK tương ứng qua topic `ack`, theo đúng payload trong `API_SPEC.md`.
- PWM: Adaptive Lighting và lệnh điều khiển thủ công đều tác động lên PWM của LED qua IRLZ44N; Adaptive Lighting chạy **cục bộ trên ESP32** (không phụ thuộc backend để hoạt động).

## 5. Database Rules

- Không tự ý đổi schema (tên bảng, tên cột) đã liệt kê trong `DATABASE.md`.
- Không tạo bảng mới nếu không thực sự cần thiết và chưa được xác nhận — hiện tại chỉ có đúng 8 entity.
- Migration phải có kiểm soát (versioned migration, không sửa trực tiếp schema production).
- Không hard-code credentials trong code hoặc migration.
- Không commit secret (connection string, password) vào Git.

## 6. API Rules

- API phải tuân thủ `API_SPEC.md`.
- Không tự ý đổi endpoint (method, path).
- Không tự ý đổi request/response contract khi đã được xác định.
- Breaking change đối với contract hiện có phải được xác nhận với người dùng/nhóm trước khi thực hiện, và phải cập nhật `API_SPEC.md` cùng lúc.

## 7. MQTT Rules

- Topic phải tuân thủ đúng danh sách trong `API_SPEC.md` Phần B.1.
- Payload phải tuân thủ đúng contract trong `API_SPEC.md` Phần B.3–B.5.
- Không tự ý đổi topic hoặc payload structure.
- QoS, retain, message expiry, retry, timeout, deduplication: các thông số vận hành này đã được chuẩn hóa tại `ARCHITECTURE.md` mục 6.3 và `API_SPEC.md` mục B.6 (đánh dấu `[ĐÃ BỔ SUNG]`, kèm rationale) — implement đúng theo các giá trị đó. Đây là **giá trị đề xuất ban đầu của nhóm để có thể bắt đầu code**, chưa qua đo đạc/hiệu chỉnh thực tế trên phần cứng; nếu cần thay đổi các con số này, phải cập nhật lại đồng thời cả hai file trên, không tự ý đổi rải rác.

## 8. Security Rules

- Password hashing: dùng **bcryptjs**, không lưu plaintext.
- JWT: dùng để xác thực API.
- RBAC: kiểm tra quyền tại backend cho mọi API, theo ma trận quyền trong `PRD.md` (gồm phạm vi truy cập theo thiết bị).
- Input validation: dữ liệu đầu vào phải được kiểm tra và làm sạch.
- Device credentials: mỗi thiết bị có `device_id` và `credential_hash` riêng, không dùng chung credential.
- Environment variables: secret/credential lưu qua biến môi trường hoặc cơ chế cấu hình an toàn.
- Secrets: không commit secret lên GitHub (bao gồm `.env`).
- Audit logs: các thao tác quan trọng phải được ghi vào `AUDIT_LOG`.
- HTTPS/TLS: sử dụng khi phù hợp với môi trường triển khai thực tế (báo cáo gốc ghi đây là điều "cân nhắc" cho môi trường thật, chưa phải yêu cầu bắt buộc ở giai đoạn prototype — xem `ARCHITECTURE.md` mục 9 và Hướng phát triển).
- **Không được tự tuyên bố** rằng một cơ chế bảo mật đã được triển khai (ví dụ "hệ thống đã có HTTPS/TLS") nếu code thực tế chưa có — phải phản ánh đúng trạng thái implementation thực tế.
- **[ĐÃ BỔ SUNG] Chi tiết JWT:** Thuật toán ký **`HS256`**; secret lấy từ biến môi trường `JWT_SECRET`; claims gồm `{ sub: user_id, role, iat, exp }`. Access Token hết hạn sau `JWT_EXPIRES_IN` giây (mặc định 900s = 15 phút); Refresh Token hết hạn sau `REFRESH_TOKEN_EXPIRES_IN` (mặc định 7 ngày). Đây là quyết định của dự án, không phải giá trị mặc định của thư viện.
- **[ĐÃ BỔ SUNG] bcrypt cost factor:** Cost factor `= 10` là giá trị chuẩn của project cho Phase 1, áp dụng nhất quán cho cả `password_hash` (User) lẫn băm `device_key` (Device). Đây là quyết định tường minh của dự án — không tự thay đổi khi implement mà không có xác nhận của nhóm.
- **[ĐÃ BỔ SUNG] Socket.IO authentication:** Chỉ chấp nhận kết nối từ client đã xác thực (có JWT access token hợp lệ). Cơ chế xác thực cụ thể (middleware handshake, truyền token...) là chi tiết implementation — xem `API_SPEC.md` mục C.3.

## 9. Git Rules

- Không commit `.env` (chỉ dùng `.env.example` làm mẫu).
- Không commit secret dưới bất kỳ hình thức nào.
- Commit phải tập trung vào một thay đổi rõ ràng (tránh commit gộp nhiều việc không liên quan).
- Không thêm trailer `Co-authored-by: Copilot` hoặc trailer nhận Copilot làm author/contributor. Trước khi push, phải kiểm tra commit message để bảo đảm GitHub chỉ ghi nhận thành viên thực hiện.
- Không sửa lịch sử Git (force push, rebase lịch sử đã chia sẻ...) nếu không được yêu cầu rõ ràng.
- Quy ước đặt tên commit message: **[ĐÃ BỔ SUNG]** Định dạng commit message: `<type>: <mô tả ngắn>` (không dùng scope). Ví dụ: `feat: add telemetry ingestion handler`, `fix: fix reconnection logic`, `docs: update MQTT payload spec`. Các type hợp lệ: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
  - *Lý do/Rationale:* Cần thống nhất quy ước commit ngay từ đầu để giữ lịch sử Git rõ ràng và hỗ trợ sinh changelog tự động.

### Agent tự động commit (không push) [ĐÃ BỔ SUNG]

AI coding agent **được phép và nên tự commit local** sau khi hoàn thành một thay đổi; agent **không được push**.

**Khi nào commit:**
- Sau khi hoàn thành một thay đổi có ý nghĩa trọn vẹn **và** đã kiểm tra phần bị ảnh hưởng (xem mục 10). Không commit code chưa chạy, build/test đang lỗi, hoặc đang làm dở.
- Mỗi commit là **một thay đổi logic duy nhất**. Task gồm nhiều việc không liên quan thì tách thành nhiều commit.
- Thay đổi code và cập nhật tài liệu tương ứng (mục 11) nằm **cùng một commit**.
- Cập nhật `PLAN.md` chỉ khi có bằng chứng cụ thể (xem `AGENTS.md` mục 4); nếu cập nhật riêng thì dùng commit `docs: ...` riêng (ví dụ `docs: update PLAN progress for phase 1`), kèm bằng chứng trong nhật ký.

**Trước khi commit, agent phải:**
1. Chạy `git status` và `git diff` để xem chính xác những gì sẽ được commit.
2. Chỉ `git add` **các file cụ thể** thuộc thay đổi hiện tại; không dùng `git add -A` / `git add .` một cách mù quáng.
3. Kiểm tra không có secret hoặc file không được commit: `.env`, `device_key`, mật khẩu, JWT secret, credential, `node_modules`, thư mục build, file log.
4. Nếu thấy secret đã nằm trong diff: **dừng**, không commit, báo cho người dùng.

**Cách commit:**
- Message theo đúng định dạng ở trên: `<type>: <mô tả ngắn>` (không có scope). Mô tả ngắn gọn, nêu rõ thay đổi gì; phần thân (nếu cần) ghi thêm thành phần bị ảnh hưởng.
- Dòng đầu ngắn gọn; phần thân (nếu cần) nêu lý do thay đổi và cách đã kiểm tra. Không ghi "test passed" nếu chưa thực sự chạy (xem mục 10).
- Commit trên **nhánh hiện tại**. Không tự tạo, chuyển, merge hoặc xóa nhánh nếu không được yêu cầu.

**Agent KHÔNG được làm:**
- `git push` (kể cả `--force`), `git push --tags`, hoặc bất kỳ thao tác nào ghi lên remote.
- Tạo/đẩy tag hoặc release (ví dụ `v1.0.0`) — việc này do nhóm quyết định.
- Sửa lịch sử: `git commit --amend` lên commit đã có từ trước, `git rebase`, `git reset --hard`, `git filter-branch`, và tương tự.
- Bỏ qua hook hoặc kiểm tra: `--no-verify`, `--no-gpg-sign`.
- Thay đổi cấu hình Git (`git config`), remote, hoặc `.gitignore` để vượt qua kiểm tra.

**Sau khi commit:** agent báo lại cho người dùng hash ngắn, message, danh sách file đã thay đổi, và nhắc rằng commit **chưa được push**. Người dùng tự xem lại (`git log`, `git show`) rồi tự push.

*Lý do/Rationale:* commit local thường xuyên giúp mỗi thay đổi nhỏ, dễ xem lại và dễ hoàn tác; việc push, tag và release là điểm kiểm soát cuối cùng thuộc về người trong nhóm, đặc biệt vì đồ án cần lịch sử commit rõ ràng của từng thành viên.

## 10. Testing Rules

- Agent phải kiểm tra phần bị ảnh hưởng bởi thay đổi trước khi coi task là hoàn thành.
- Bao gồm khi phù hợp:
  - Unit test cho logic nghiệp vụ (ví dụ: logic tính alert, logic Adaptive Lighting).
  - API test cho các endpoint bị ảnh hưởng.
  - MQTT test cho luồng telemetry/command/ack bị ảnh hưởng.
  - Integration test cho luồng end-to-end liên quan.
  - Security/RBAC test (ví dụ: đảm bảo Viewer bị từ chối khi gọi API điều khiển — tương ứng TC09 trong `PRD.md`).
- Không được tạo kết quả test giả hoặc báo cáo "test passed" khi chưa thực sự chạy test.
- Lưu ý: báo cáo gốc hiện **chưa có kết quả kiểm thử thực tế** (các test case TC01–TC10 và các chỉ tiêu phi chức năng trong `PRD.md` mục Acceptance Criteria đều đang ở trạng thái "chưa đo/chưa chạy"). Agent không được điền số liệu hoặc kết quả thay cho nhóm.

## 11. Documentation Rules

Nếu thay đổi:

- **API** → cập nhật `API_SPEC.md`.
- **Database** → cập nhật `DATABASE.md`.
- **Architecture** → cập nhật `ARCHITECTURE.md`.
- **Requirement** → cập nhật `PRD.md`.

Thay đổi code và cập nhật tài liệu tương ứng nên nằm trong cùng một thay đổi (cùng PR/commit liên quan), để tránh tài liệu bị lệch khỏi thực tế implementation.
