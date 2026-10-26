# PLAN — Tiến độ triển khai Smart Lighting System

> **File này chỉ ghi nhận tiến độ, không phải nguồn xác nhận trạng thái.**
> Theo đúng thứ tự ưu tiên "Source of Truth" trong `AGENTS.md`, file này đứng **dưới** cả code hiện có lẫn tài liệu trong `docs/`. Một dòng đánh dấu `Done` phải đi kèm bằng chứng cụ thể (đường dẫn file/commit, hoặc kết quả chạy test) — không tự đánh dấu `Done` chỉ vì đã yêu cầu agent code việc đó, hoặc vì agent tự báo cáo đã xong. Nếu nghi ngờ, coi như `In progress` và tự kiểm tra lại code/file thật trước khi đổi trạng thái.
>
> File này không lặp lại nội dung contract (schema, endpoint, payload...) — mọi chi tiết kỹ thuật vẫn nằm trong `docs/`. Ở đây chỉ trỏ link và ghi trạng thái.

---

## 1. Bảng giai đoạn

| # | Giai đoạn | Tài liệu tham chiếu | Status |
|---|---|---|---|
| 1 | Database & Schema | `docs/DATABASE.md` | Done |
| 2 | Backend Core (Auth, RBAC) | `docs/API_SPEC.md` Phần A.1–A.2, `docs/PROJECT-RULES.md` mục 2, 8 | Done |
| 3 | MQTT Integration | `docs/API_SPEC.md` Phần B, `docs/ARCHITECTURE.md` mục 6.3, 7 | In progress |
| 4 | REST API (Devices, Commands, Alerts, Dashboard, Audit) | `docs/API_SPEC.md` Phần A.3–A.8 | In progress |
| 5 | Socket.IO Realtime | `docs/API_SPEC.md` Phần C | Not started |
| 6 | Frontend Core (Auth, Dashboard, Control) | `docs/PROJECT-RULES.md` mục 3 | Not started |
| 7 | Firmware ESP32 | `docs/API_SPEC.md` Phần B, `docs/ARCHITECTURE.md` mục 4, 7, `docs/PROJECT-RULES.md` mục 4 | Not started |
| 8 | Deployment (Docker Compose) | `docs/ARCHITECTURE.md` mục 3, `.env.example` | Not started |
| 9 | Testing & Integration | `docs/PRD.md` mục Acceptance Criteria, `docs/PROJECT-RULES.md` mục 10 | Not started |

Trạng thái hợp lệ: `Not started` / `In progress` / `Done`. Không dùng các nhãn khác (ví dụ "Mostly done", "90%") — nếu chưa đạt đủ điều kiện `Done` ở mục 2 bên dưới thì vẫn là `In progress`.

---

## 2. Definition of Done cho từng giai đoạn

### Giai đoạn 1 — Database & Schema
Done khi:
- Migration đã chạy thành công trên môi trường local (`docker compose --env-file .env -f deployment/docker-compose.yml up` + migration script không lỗi).
- Đủ 8 bảng đúng tên (`snake_case`, gồm `users` và `device_access`, xem `docs/DATABASE.md` mục 3), đúng cột như `docs/DATABASE.md`, không thừa/thiếu bảng.
- Seed data: 3 role (`ADMIN`/`OPERATOR`/`VIEWER`) + 1 user admin mặc định đã insert được và query lại thấy đúng.
- Password của user admin seed phải được cung cấp qua environment (`SEED_ADMIN_PASSWORD`) hoặc cơ chế local-only tương đương; không hard-code secret trong migration/seed.
- Đã tự chạy thử ít nhất 1 câu lệnh vi phạm CHECK constraint (ví dụ insert `command_type='PWM'` với `command_value=NULL`) và xác nhận bị DB từ chối đúng như thiết kế ở mục 8 — COMMAND (phần "CHECK liên trường").
- Đã tự chạy thử insert bản ghi `device_access` trùng khóa chính kép `(user_id, device_id)` và xác nhận bị DB từ chối.

### Giai đoạn 2 — Backend Core
Done khi:
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `PUT /auth/password` chạy được qua Postman/curl, trả đúng status code như spec.
- RBAC middleware: tự test bằng tài khoản Viewer gọi một API chỉ-Admin (ví dụ `POST /users`) và xác nhận bị `403`.
- JWT dùng đúng `HS256`, claims đúng `{sub, role, iat, exp}` (xem `docs/PROJECT-RULES.md` mục 8) — tự decode 1 token thật để xác nhận.
- Format lỗi đúng `{code, message, details}` và thứ tự kiểm tra 401 → 403 → 404 → 400 → 409 (xem `docs/API_SPEC.md` mục "Quy ước chung về lỗi và phạm vi truy cập"): tự thử ít nhất 1 request cho mỗi mã.
- Test JWT không hợp lệ và JWT hết hạn nhận `401` (TC12).

### Giai đoạn 3 — MQTT Integration
Done khi:
- Backend kết nối được tới Mosquitto (log connect thành công).
- Có thể tự publish một bản tin telemetry giả (qua `mosquitto_pub` hoặc script) và thấy backend nhận + lưu vào bảng TELEMETRY.
- Retry/dedup logic đã tự test với ít nhất 1 kịch bản: publish trùng `command_id` và xác nhận ESP32/mock không thực thi lại lần hai.
- **Cơ chế xác thực MQTT cho ESP32 (`device_key` ↔ `credential_hash`) phải được quyết định và kiểm chứng đủ để coi Giai đoạn 3 là `Done`.** Việc dựng/test Backend–Mosquitto connectivity có thể thực hiện trước bằng credential/mock phù hợp, nhưng không được đánh dấu `Done` khi cơ chế xác thực thiết bị vẫn còn `TODO/UNDEFINED`.
- Đã kiểm chứng: ACL theo `device_id` (thiết bị publish topic của thiết bị khác bị từ chối — TC14) và quyền kết nối theo `lifecycle_status` (`MAINTENANCE`/`DECOMMISSIONED` bị từ chối, `PROVISIONED` được phép — TC10, TC13) theo `docs/API_SPEC.md` mục B.7. Nên thử trên thiết bị mô phỏng `LIGHT-002` trước.

### Giai đoạn 4 — REST API
Done khi mỗi endpoint trong `docs/API_SPEC.md` Phần A đã:
- Có route thực tế trả đúng status code cho ít nhất 1 case thành công và 1 case lỗi đã liệt kê trong spec.
- Mỗi endpoint/feature có ít nhất 1 test case (`TCxx`) liên quan đã chạy thử thủ công ít nhất 1 lần; các TC phải được xác định theo feature/endpoint thực tế, không dùng danh sách mơ hồ hoặc bỏ sót bằng dấu `...`.
- Kết quả test liên quan trong `docs/PRD.md` mục Acceptance Criteria phải được ghi lại (không cần số liệu định lượng, chỉ cần pass/fail).
- Mọi endpoint theo thiết bị đã test với Operator có và không có `DEVICE_ACCESS` (TC11), và với Viewer bị `403` khi gọi endpoint ghi (TC09); endpoint `GET/PUT /devices/:id/access` đã chạy được.

### Giai đoạn 5 — Socket.IO Realtime
Done khi:
- Cả 4 event (`telemetry:update`, `device:status`, `command:update`, `alert:new`) đã tự bắn thử và xác nhận client nhận được đúng payload.
- Đã tự test: client chưa có JWT hợp lệ bị từ chối kết nối.
- Client chỉ nhận event của thiết bị mình được cấp quyền (room `device:{device_id}`, xem `docs/API_SPEC.md` mục C.2).
- Khi client reload/reconnect, dữ liệu trạng thái hiện tại phải được lấy từ REST/Database như **source of truth**; Socket.IO chỉ dùng để cập nhật realtime, không được coi là persistence hoặc cơ chế đảm bảo client luôn nhận được mọi event.

### Giai đoạn 6 — Frontend Core
Done khi:
- Login flow chạy được end-to-end với backend thật (không phải mock).
- Dashboard hiển thị được telemetry realtime qua Socket.IO (tự quan sát số liệu thay đổi khi giả lập gửi telemetry mới).
- RBAC UI: tự đăng nhập bằng cả 3 role và xác nhận đúng menu/nút hiển thị khác nhau.

### Giai đoạn 7 — Firmware ESP32
Done khi:
- Nạp được firmware lên board thật (không phải chỉ compile thành công).
- Đọc được cả 3 cảm biến (BH1750, RCWL-0516, INA219) và publish telemetry thấy backend nhận đúng.
- Nhận lệnh PWM/ON/OFF từ backend, đèn thực sự đổi độ sáng, ACK gửi về đúng.
- Manual override hoạt động đúng như `docs/ARCHITECTURE.md` mục 7.2 (tự test bằng tay: đặt PWM thủ công, xác nhận Adaptive không ghi đè cho đến khi motion đổi).
- Thiết bị dùng `device_id` + `device_key` riêng để kết nối MQTT (không dùng chung khóa với thiết bị khác).
- Mất Wi-Fi/MQTT → thiết bị tự reconnect → sau khi reconnect thành công phải publish trạng thái `ONLINE` đúng theo contract; backend phải cập nhật trạng thái thiết bị đúng.

### Giai đoạn 8 — Deployment
Done khi:
- `docker compose --env-file .env -f deployment/docker-compose.yml up` (chạy từ gốc repo) trên máy mới có Docker Engine + Docker Compose, chưa có source/dependency/runtime setup nào khác, khởi động được đủ Backend + Mosquitto + PostgreSQL + Frontend.
- Người test được phép và phải tạo `.env` từ `.env.example`, sau đó **điền các giá trị hợp lệ cho toàn bộ biến bắt buộc** (bao gồm các credential/secret cần thiết); không coi việc chỉ copy file mẫu sang `.env` là đủ.
- Không cần sửa tay source code, Dockerfile, compose file hoặc cấu hình ứng dụng sau khi checkout; chỉ cần điền `.env` theo hướng dẫn của project.

### Giai đoạn 9 — Testing & Integration
Done khi toàn bộ TC01–TC10 trong `docs/PRD.md` đã chạy ít nhất 1 lần trên hệ thống thật (không phải mock), kết quả pass/fail được ghi lại — không cần đạt 100% pass để coi là "đã chạy", nhưng phải ghi rõ TC nào fail và lý do.

---

## 3. Known open items (các điểm còn mở, chưa chặn code nhưng cần nhớ)

| Điểm | Ghi ở đâu | Ghi chú |
|---|---|---|
| Cơ chế xác thực MQTT cho ESP32 (`device_key` ↔ `credential_hash`) | `docs/API_SPEC.md` mục A.3, `docs/DATABASE.md` cột `credential_hash` | Nguyên tắc đã chốt tại `docs/API_SPEC.md` mục B.7 (xác thực dựa trên DB + ACL theo `device_id`). **Plugin cụ thể và tương thích hash `bcryptjs`: `TODO/UNDEFINED`** — kiểm chứng bằng prototype nhỏ trước giai đoạn 3/7. |
| Cách kiểm tra lại quyền khi access token hết hạn trong phiên Socket.IO | `docs/API_SPEC.md` Phần C.2 | `TODO/UNDEFINED` — hiện xác thực JWT lúc handshake và cấp room theo `device_id`; cần chốt cơ chế revalidation/reconnect khi token hết hạn. |
| Lưu `manual_override`/`last_manual_pwm` qua reboot (NVS) | `docs/ARCHITECTURE.md` mục 7.2 | Hiện coi là biến RAM, mất khi ESP32 khởi động lại. |
| Endpoint REST xem lịch sử/trạng thái command | `docs/API_SPEC.md` mục A.5 | Chưa có, không tự thêm khi chưa xác nhận. |
| Công thức map PWM % → duty cycle LEDC | `docs/DATABASE.md` mục 3 | Để cho tầng firmware tự quyết định khi code, miễn giữ nguyên tắc 0–100% ở tầng dữ liệu. |
| Số liệu benchmark hiệu năng (độ trễ, tỷ lệ mất tin, uptime) | `docs/PRD.md` mục Non-functional Requirements, Acceptance Criteria | `TODO — chờ đo thực tế`, không tự bịa số liệu ở bất kỳ giai đoạn nào. |
| Retry/timeout/dedup (5s/1s/2s/30s/60s/50 cache) | `docs/ARCHITECTURE.md` mục 6.3, `docs/API_SPEC.md` mục B.6 | Giá trị đề xuất ban đầu để bắt đầu code, cần hiệu chỉnh sau khi đo trên phần cứng thật — không phải số liệu đã kiểm chứng. |
| Cơ chế ngắt thiết bị đang kết nối khi chuyển `MAINTENANCE`/`DECOMMISSIONED` | `docs/API_SPEC.md` mục B.7, `docs/ARCHITECTURE.md` mục 8 | `TODO/UNDEFINED` — cache ACL TTL ngắn hoặc backend chủ động ngắt client. |
| Chính sách lưu trữ (retention) dữ liệu telemetry | `docs/PRD.md` mục Non-functional (Privacy) | `TODO/UNDEFINED`. |
| Mô hình mối đe dọa và biện pháp kiểm soát | Đề bài mục 6 (bắt buộc) | Chưa viết — bảng: mối đe dọa, tài sản, biện pháp, test tương ứng; đặt trong `docs/ARCHITECTURE.md` hoặc báo cáo. |
| Giải thích vì sao cần IoT thay vì web thuần | Đề bài mục 4.1 | Chưa viết — thêm 1 đoạn vào `docs/PRD.md` mục 1. |
| Thiết bị mô phỏng `LIGHT-002` (trình giả lập MQTT trong `tests/mqtt-simulator`) | `docs/PRD.md` mục 3 | Cần có để demo TC11; không thay thế thiết bị vật lý, báo cáo phải ghi rõ thiết bị nào là mô phỏng. |

---

## 4. Nhật ký cập nhật

> Mỗi khi đổi trạng thái một giai đoạn, thêm 1 dòng vào đây: ngày, giai đoạn, trạng thái mới, bằng chứng và loại bằng chứng. Không đánh dấu `Done` nếu chưa có evidence kiểm chứng thực tế.

| Ngày | Giai đoạn | Trạng thái mới | Bằng chứng | Loại evidence |
| ---- | --------- | -------------- | --------- | -------------- |
| 2026-10-10 | Giai đoạn 1 — Database & Schema | Done | PostgreSQL 18 chạy bằng Docker Compose trên host port tạm `55432`; migration `database/migrations/001_initial_schema.sql` chạy thành công, tạo đúng 8 bảng; seed `database/seeds/001_roles_and_admin.sql` tạo 3 role và 1 admin; smoke check CHECK liên trường của `command` và khóa kép `device_access` đều bị DB từ chối đúng thiết kế. | Docker/PostgreSQL runtime validation |
| 2026-10-10 | Giai đoạn 2 — Backend Core (Auth, RBAC) | Done | `npm run typecheck` và `npm test` đạt; integration suite `backend/src/phase2.integration.test.ts` pass 6/6 cho login, refresh cookie, logout, đổi mật khẩu, JWT invalid/expired, JWT HS256 claims, Viewer nhận 403, và lỗi 400/404/409 đúng format. HTTP smoke test trên backend port `3100` với PostgreSQL Docker port `55432`: `/health`, `/auth/login`, `/auth/refresh` trả đúng 200; access token có `HS256`, `sub`, `role`, `iat`, `exp`; không lộ `password_hash`. | Automated integration tests + HTTP/Docker runtime validation |
| 2026-10-17 | Giai đoạn 4 — REST API | In progress | Đã triển khai `/devices` và telemetry, `/alerts`, `/dashboard/summary`, `/dashboard/devices`, `/audit-logs` và `POST /devices/:id/commands`; command validate `ON/OFF/PWM`, kiểm tra `DEVICE_ACCESS` + trạng thái thiết bị, lưu `PENDING` và ghi `SEND_COMMAND` vào audit log. Các test trước đó pass 11/11; `npm run typecheck`, `npm run build` pass. `commands.integration.test.ts` đã thêm nhưng chưa chạy được vì Docker daemon/PostgreSQL chưa hoạt động; MQTT publish/ACK vẫn chờ tích hợp. | Automated tests + PostgreSQL runtime validation pending |
| 2026-10-22 | Giai đoạn 3 — MQTT Integration | In progress | Đã thêm MQTT.js client cho backend, subscribe telemetry/status/ack, lưu telemetry, cập nhật heartbeat/device lifecycle, publish command QoS 1 với retry 5s và backoff 1s/2s, cập nhật ACK/FAILED/TIMEOUT và thêm Mosquitto service vào Docker Compose. `npm run typecheck`, `npm run build` và `docker compose config` pass; runtime MQTT/PostgreSQL chưa kiểm chứng vì Docker daemon đang tắt. Cơ chế broker xác thực `device_key` ↔ `credential_hash` và ACL production vẫn TODO/UNDEFINED theo contract. | Static/build validation; runtime pending |
| 2026-10-22 | Giai đoạn 3 — MQTT Integration | In progress | Runtime Docker đã kiểm chứng: backend kết nối Mosquitto; telemetry hợp lệ được lưu và cập nhật `ONLINE`; `MAINTENANCE` bị bỏ qua; heartbeat quá 30 giây chuyển `OFFLINE` và tạo `DEVICE_OFFLINE`. ACL động theo `device_id`/`lifecycle_status` được chủ động hoãn theo lựa chọn triển khai; broker vẫn chưa đủ evidence cho TC10/TC13/TC14. | Docker/Mosquitto/PostgreSQL runtime validation |
| 2026-10-22 | Giai đoạn 4 — REST API | In progress | `npm run typecheck`, `npm run build` và backend integration suite pass 14/14; runtime smoke test xác nhận `/health`, MQTT telemetry persistence và heartbeat transitions trên PostgreSQL Docker. Chưa có evidence đầy đủ cho mọi success/error case của toàn bộ REST contract. | Automated tests + Docker runtime validation |
| 2026-10-22 | Giai đoạn 5 — Socket.IO Realtime | In progress | Đã thêm Socket.IO gateway với JWT handshake, room `device:{device_id}` theo `DEVICE_ACCESS`, và event bridge cho `telemetry:update`, `device:status`, `command:update`, `alert:new`. Runtime kiểm chứng: JWT hợp lệ kết nối, client không JWT nhận `UNAUTHORIZED`, Admin nhận telemetry event đúng device room. Chưa hoàn tất revalidation khi token hết hạn và test scope Operator/Viewer. | Build + Socket.IO runtime smoke validation |
| 2026-10-26 | Giai đoạn 5 — Socket.IO Realtime | In progress | Gateway tự ngắt socket khi access token hết hạn; `PUT /devices/:id/access` gọi refresh room cho socket đang kết nối để áp dụng cả cấp mới và thu hồi quyền. `npm run typecheck` và `npm run build` pass. `npm test` chưa chạy được do PostgreSQL `localhost:55432` không hoạt động (`ECONNREFUSED`); chưa đánh dấu Done vì còn thiếu runtime test Operator/Viewer và reconnect thực tế. | TypeScript/build validation; integration runtime blocked |
