# DATABASE — Smart Lighting System

> Đây là database specification. Agent phải tham khảo file này **trước khi** thay đổi schema hoặc viết database-related code. Không tự thêm bảng, không tự quyết định data type/index/cascade behavior/constraint nếu chưa được xác định — đánh dấu `TODO/UNDEFINED`.

## 1. Database Overview

- **Hệ quản trị:** PostgreSQL (phiên bản 18 theo bảng công nghệ trong `ARCHITECTURE.md`).
- **Vai trò:** lưu trữ toàn bộ dữ liệu quản lý và vận hành của hệ thống. Backend là thành phần **duy nhất** được phép truy cập trực tiếp PostgreSQL.
- **Dữ liệu quản lý:**
  - Telemetry — dữ liệu cảm biến gửi định kỳ từ thiết bị.
  - Command — lệnh điều khiển gửi tới thiết bị và trạng thái/kết quả.
  - Alert — cảnh báo phát sinh (lamp fault, device offline...).
  - Audit — nhật ký các thao tác quan trọng trong hệ thống.
  - Ngoài ra còn User, Role, Device phục vụ quản lý người dùng, phân quyền và thiết bị.
- Cấu hình Adaptive Lighting (`adaptive_config`) dùng kiểu **JSONB**, lưu trong bảng `DEVICE`.

## 2. Entities

Đúng 8 entity hiện tại (không tự thêm bảng):

```text
ROLE
users
DEVICE
DEVICE_ACCESS
TELEMETRY
COMMAND
ALERT
AUDIT_LOG
```

## 3. Table Specification — quy ước chung

Với mỗi bảng dưới đây:
- Cột đầu tiên trong danh sách field là khóa chính (primary key), theo quy ước đặt tên trong báo cáo gốc.
- **Data type, độ dài, index, cascade behavior, và constraint cụ thể:** **[ĐÃ BỔ SUNG]** Đã chuẩn hóa chi tiết cho PostgreSQL 18 để phục vụ trực tiếp việc viết mã nguồn migration CSDL.
  - **Thang đo PWM:** Thống nhất toàn hệ thống dùng **phần trăm ($0 - 100\%$)**, lưu dưới dạng `SMALLINT CHECK (pwm >= 0 AND pwm <= 100)`. Tầng Firmware ESP32 chịu trách nhiệm ánh xạ (map) từ phần trăm sang giá trị duty cycle thô của timer phần cứng LEDC.
    - *Lý do/Rationale:* Việc dùng thang đo phần trăm ($0 - 100\%$) giúp thống nhất trực quan với giao diện Web UI, đơn giản hóa việc cấu hình ngưỡng Adaptive Lighting và độc lập hoàn toàn với cấu hình phần cứng (bit resolution) của timer LEDC trên ESP32.
  - **Chính sách xóa Device & Cascade behavior:** Trong vận hành thực tế, hệ thống **không xóa vật lý (hard delete)** bản ghi trong bảng `DEVICE`, mà chỉ chuyển trạng thái `lifecycle_status = 'DECOMMISSIONED'` (soft-decommission). Để đảm bảo toàn vẹn dữ liệu truy vết:
    - Cả ba bảng `TELEMETRY`, `COMMAND` và `ALERT` đều áp dụng **`ON DELETE RESTRICT`** đối với `device_id` — một chính sách duy nhất, nhất quán: không cho phép hard-delete Device khi còn bất kỳ dữ liệu lịch sử vận hành nào (kể cả telemetry). Đây là **chủ đích thiết kế**, không phải hạn chế phát sinh ngoài ý muốn — telemetry cũng cần thiết để tra soát lại điều kiện tại thời điểm phát sinh một `LAMP_FAULT` hay `DEVICE_OFFLINE`, nên không có lý do kỹ thuật để bảo vệ TELEMETRY ở mức thấp hơn COMMAND/ALERT.
    - Dọn dẹp dữ liệu test/dev (nếu cần) không dựa vào cascade ngầm định, mà thực hiện bằng thao tác tường minh, đúng thứ tự: xóa các bản ghi `TELEMETRY` theo `device_id` trước, sau đó mới xóa/đổi trạng thái `DEVICE`. Việc này giữ cho thao tác dọn dữ liệu luôn có chủ đích và dễ audit lại.
    - *Lý do/Rationale:* Lịch sử telemetry, lệnh điều khiển và cảnh báo sự cố đều là dữ liệu phục vụ audit, điều tra nguyên nhân hỏng hóc và trách nhiệm vận hành, nên không được phép bị mất khi thiết bị ngừng hoạt động.

- **Quy ước tên bảng trong migration: [ĐÃ BỔ SUNG]** dùng `snake_case` chữ thường, **không dùng dấu nháy kép**: `role`, `users`, `device`, `device_access`, `telemetry`, `command`, `alert`, `audit_log`. Bảng tài khoản đặt tên `users` (không phải `USER`) vì `USER` là từ khóa dành riêng của PostgreSQL. Các tên viết hoa trong tài liệu này (`ROLE`, `DEVICE`, `TELEMETRY`...) chỉ là tên thực thể; tên bảng thật theo quy ước trên.
  - *Lý do/Rationale:* tránh phải dùng identifier có nháy kép ở mọi câu SQL/ORM và tránh lỗi cú pháp do từ khóa dành riêng.

## 4. ROLE

- **Table name:** `ROLE`
- **Purpose:** Định nghĩa các vai trò trong hệ thống (Admin, Operator, Viewer).
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `role_id` | SERIAL / INT | PRIMARY KEY | Khóa chính |
| `role_name` | VARCHAR(30) | NOT NULL, UNIQUE, CHECK (role_name IN ('ADMIN', 'OPERATOR', 'VIEWER')) | Tên vai trò |
| `description` | VARCHAR(255) | NULL | Mô tả vai trò |

- **Primary key:** `role_id`
- **Foreign keys:** không có
- **Relationships:** `ROLE → users` (1:N)
- **Constraints: [ĐÃ BỔ SUNG]** `UNIQUE(role_name)`, CHECK constraint đúng 3 vai trò: `ADMIN`, `OPERATOR`, `VIEWER`.
  - *Lý do/Rationale:* Cần thiết để khởi tạo seed dữ liệu ban đầu cho database và ràng buộc phân quyền RBAC ở tầng backend.

## 5. users

- **Table name:** `users`
- **Purpose:** Lưu thông tin tài khoản người dùng.
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `user_id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Khóa chính UUID v4 |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | Tên đăng nhập |
| `email` | VARCHAR(100) | NOT NULL, UNIQUE | Email người dùng |
| `password_hash` | VARCHAR(255) | NOT NULL | Mật khẩu băm (bcryptjs) |
| `role_id` | INT | NOT NULL, REFERENCES ROLE(role_id) ON DELETE RESTRICT | Khóa ngoại vai trò |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'ACTIVE', CHECK (status IN ('ACTIVE', 'LOCKED')) | Trạng thái tài khoản: `ACTIVE` (đăng nhập/sử dụng bình thường), `LOCKED` (bị khóa, không được đăng nhập) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm cập nhật |

- **Primary key:** `user_id`
- **Foreign keys:** `role_id` → `ROLE.role_id` (ON DELETE RESTRICT — không cho phép xóa role khi vẫn còn user gắn với role).
- **Relationships:** `users → DEVICE` (1:N, qua `assigned_user_id`), `users → COMMAND` (1:N), `users → ALERT` (1:N, qua `acknowledged_by`/`resolved_by`), `users → AUDIT_LOG` (1:N)
- **Constraints: [ĐÃ BỔ SUNG]** `UNIQUE(username)`, `UNIQUE(email)`, CHECK constraint cho `status` (chỉ `ACTIVE`/`LOCKED`, khớp với `PATCH /users/:id/status` trong `API_SPEC.md`).
  - *Lý do/Rationale:* Cần thiết để lập trình tầng ORM/Repository và validate dữ liệu khi đăng ký/đăng nhập. Độ dài `password_hash` 255 ký tự đảm bảo lưu trọn vẹn chuỗi băm chuẩn bcrypt.

## 6. DEVICE

- **Table name:** `DEVICE`
- **Purpose:** Lưu thông tin và trạng thái từng thiết bị ESP32 trong hệ thống.
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `device_id` | VARCHAR(50) | PRIMARY KEY | Khóa chính mã thiết bị (ví dụ: `LIGHT-001`) |
| `device_name` | VARCHAR(100) | NOT NULL | Tên gợi nhớ của thiết bị |
| `location` | VARCHAR(150) | NULL | Vị trí lắp đặt (ví dụ: Phòng khách) |
| `assigned_user_id` | UUID | NULL, REFERENCES users(user_id) ON DELETE SET NULL | Người phụ trách thiết bị (metadata nghiệp vụ/hiển thị). **Không quyết định quyền truy cập** — quyền truy cập do bảng `DEVICE_ACCESS` quyết định |
| `device_status` | VARCHAR(20) | NOT NULL DEFAULT 'OFFLINE', CHECK (device_status IN ('ONLINE', 'OFFLINE', 'FAULT')) | Trạng thái kết nối/hoạt động |
| `lifecycle_status` | VARCHAR(20) | NOT NULL DEFAULT 'REGISTERED', CHECK (lifecycle_status IN ('REGISTERED', 'PROVISIONED', 'ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED')) | Trạng thái vòng đời thiết bị |
| `firmware_version` | VARCHAR(30) | NOT NULL DEFAULT '1.0.0' | Phiên bản firmware hiện tại |
| `credential_hash` | VARCHAR(255) | NOT NULL | Khóa nhận thực thiết bị — **[ĐÃ BỔ SUNG]** băm bcryptjs (cost factor 10) của `device_key` được sinh khi onboarding (`POST /devices`). `device_key` plaintext chỉ trả về một lần duy nhất, không lưu trong DB. Cơ chế broker/backend dùng hash này để xác thực kết nối MQTT của ESP32 là `TODO/UNDEFINED` (xem `API_SPEC.md` mục A.3) |
| `adaptive_config` | JSONB | NOT NULL DEFAULT '{"enabled": true, "motion_timeout_sec": 30, "lux_thresholds": [{"min_lux": 400, "pwm": 30}, {"min_lux": 200, "pwm": 50}, {"min_lux": 100, "pwm": 70}, {"min_lux": 0, "pwm": 100}], "no_motion_pwm": 10}'::jsonb | Cấu hình Adaptive Lighting |
| `last_seen_at` | TIMESTAMPTZ | NULL | Thời điểm cuối cùng nhận tín hiệu |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm cập nhật |

- **Primary key:** `device_id`
- **Foreign keys:** `assigned_user_id` → `users.user_id` (ON DELETE SET NULL — khi tài khoản người dùng bị xóa, thiết bị vẫn giữ nguyên).
- **Relationships:** `DEVICE → TELEMETRY` (1:N), `DEVICE → COMMAND` (1:N), `DEVICE → ALERT` (1:N), `DEVICE → AUDIT_LOG` (1:N), `DEVICE → DEVICE_ACCESS` (1:N)
- **Constraints: [ĐÃ BỔ SUNG]** CHECK constraint cho `device_status` ('ONLINE', 'OFFLINE', 'FAULT') và `lifecycle_status` ('REGISTERED', 'PROVISIONED', 'ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED').
  - *Lý do/Rationale:* Cần thiết để code API Onboarding và Lifecycle state machine. `device_status` và `lifecycle_status` là 2 trạng thái độc lập phản ánh khía cạnh kỹ thuật thời gian thực và quản trị vòng đời thiết bị.

> Ghi chú quan trọng: `device_status` (ONLINE/OFFLINE/FAULT) và `lifecycle_status` (REGISTERED/PROVISIONED/ACTIVE/MAINTENANCE/DECOMMISSIONED) là **hai trường độc lập**, không được gộp chung hay nhầm lẫn.

## 6A. DEVICE_ACCESS

- **Table name:** `device_access`
- **Purpose:** Xác định user nào (Operator/Viewer) được truy cập thiết bị nào. Admin luôn truy cập mọi thiết bị, không cần bản ghi.
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `user_id` | UUID | NOT NULL, REFERENCES users(user_id) ON DELETE CASCADE | User được cấp quyền |
| `device_id` | VARCHAR(50) | NOT NULL, REFERENCES DEVICE(device_id) ON DELETE RESTRICT | Thiết bị được cấp |
| `granted_by` | UUID | NULL, REFERENCES users(user_id) ON DELETE SET NULL | Admin đã cấp quyền |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm cấp |

- **Primary key:** `(user_id, device_id)` (khóa chính kép).
- **Foreign keys:** `user_id` → `users.user_id` (ON DELETE CASCADE); `device_id` → `DEVICE.device_id` (ON DELETE RESTRICT — nhất quán chính sách không hard-delete Device); `granted_by` → `users.user_id` (ON DELETE SET NULL).
- **Relationships:** `users → DEVICE_ACCESS` (1:N), `DEVICE → DEVICE_ACCESS` (1:N); tổng hợp là quan hệ N:N giữa `users` và `DEVICE`.
- **Constraints & Indexes: [ĐÃ BỔ SUNG]** `CREATE INDEX idx_device_access_device ON DEVICE_ACCESS (device_id);` (tên bảng thật: `device_access`).
- **Quy tắc:**
  - Bản ghi của user có role `ADMIN` bị bỏ qua khi kiểm tra quyền (Admin luôn thấy tất cả); API không cho tạo bản ghi cho Admin.
  - Đổi role của user không tự xóa/tạo bản ghi: user từ Admin xuống Operator/Viewer sẽ không thấy thiết bị nào cho đến khi được cấp.
  - Thiết bị `DECOMMISSIONED` vẫn giữ bản ghi (phục vụ truy xuất lịch sử).
  - `assigned_user_id` của `DEVICE` **không** thay thế bảng này.
  - *Lý do/Rationale:* `assigned_user_id` chỉ chứa một user nên không thể cấp một thiết bị cho nhiều user; cần bảng liên kết để đáp ứng yêu cầu người dùng chỉ truy cập thiết bị thuộc phạm vi được cấp quyền.

## 7. TELEMETRY

- **Table name:** `TELEMETRY`
- **Purpose:** Lưu dữ liệu cảm biến gửi định kỳ từ thiết bị.
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `telemetry_id` | BIGSERIAL | PRIMARY KEY | Khóa chính tăng tự động |
| `device_id` | VARCHAR(50) | NOT NULL, REFERENCES DEVICE(device_id) ON DELETE RESTRICT | Thiết bị đo |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm đo đạc |
| `lux` | NUMERIC(8,2) | NOT NULL | Cường độ ánh sáng (Lux) |
| `motion` | BOOLEAN | NOT NULL DEFAULT FALSE | Trạng thái chuyển động |
| `voltage` | NUMERIC(6,2) | NOT NULL | Điện áp đo được (V) |
| `current` | NUMERIC(6,3) | NOT NULL | Dòng điện tiêu thụ (A) |
| `power` | NUMERIC(7,3) | NOT NULL | Công suất tiêu thụ (W) |
| `pwm` | SMALLINT | NOT NULL, CHECK (pwm >= 0 AND pwm <= 100) | Thang đo phần trăm PWM (0–100%) |

- **Primary key:** `telemetry_id`
- **Foreign keys:** `device_id` → `DEVICE.device_id` (**ON DELETE RESTRICT** — nhất quán với `COMMAND`/`ALERT`: không cho phép hard-delete Device khi còn dữ liệu telemetry. Dọn dữ liệu test/dev dùng script tường minh xóa `TELEMETRY` trước, sau đó mới xử lý `DEVICE`).
- **Relationships:** thuộc về 1 `DEVICE`
- **Constraints & Indexes: [ĐÃ BỔ SUNG]** CHECK constraint `pwm BETWEEN 0 AND 100`. Index tăng tốc truy vấn lịch sử: `CREATE INDEX idx_telemetry_device_timestamp ON TELEMETRY (device_id, timestamp DESC);`.
  - *Lý do/Rationale:* Thang đo PWM phần trăm (0–100%) đồng nhất với Web UI và Adaptive rule; Index kép `(device_id, timestamp DESC)` bắt buộc phải có để truy vấn biểu đồ thời gian thực không bị chậm khi số lượng bản ghi telemetry tăng nhanh (mỗi 5s một bản tin). `ON DELETE RESTRICT` bảo vệ toàn vẹn dữ liệu audit giống hai bảng `COMMAND`/`ALERT`.

## 8. COMMAND

- **Table name:** `COMMAND`
- **Purpose:** Lưu lệnh điều khiển gửi tới thiết bị và kết quả thực thi.
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `command_id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Khóa chính UUID |
| `device_id` | VARCHAR(50) | NOT NULL, REFERENCES DEVICE(device_id) ON DELETE RESTRICT | Thiết bị nhận lệnh |
| `user_id` | UUID | NULL, REFERENCES users(user_id) ON DELETE SET NULL | Người gửi lệnh |
| `command_type` | VARCHAR(20) | NOT NULL, CHECK (command_type IN ('PWM', 'ON', 'OFF')) | Loại lệnh |
| `command_value` | SMALLINT | NULL, CHECK (command_value BETWEEN 0 AND 100) | Giá trị PWM theo phần trăm (số nguyên 0–100); bắt buộc khi `command_type = 'PWM'`, phải NULL khi `ON`/`OFF` (xem constraint liên trường bên dưới) |
| `status` | VARCHAR(25) | NOT NULL DEFAULT 'PENDING', CHECK (status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'TIMEOUT', 'FAILED')) | Trạng thái lệnh (luồng chuyển trạng thái: xem `API_SPEC.md` mục B.6) |
| `sent_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm lệnh được tạo/publish lần đầu (không đổi khi retry) |
| `ack_at` | TIMESTAMPTZ | NULL | Thời điểm nhận ACK |
| `result` | VARCHAR(50) | NULL | Kết quả thực thi (giá trị `result` trong ACK, ví dụ `PWM_SET`, `COMMAND_EXPIRED`) |

- **Primary key:** `command_id`
- **Foreign keys:** `device_id` → `DEVICE.device_id` (**ON DELETE RESTRICT** — ngăn chặn việc xóa cứng thiết bị khi đã có lệnh điều khiển trong quá khứ); `user_id` → `users.user_id` (ON DELETE SET NULL).
- **Relationships:** thuộc về 1 `DEVICE` và 1 `users`
- **Constraints & Indexes: [ĐÃ BỔ SUNG]** CHECK ràng buộc `command_type` ('PWM', 'ON', 'OFF'), `status` ('PENDING', 'SENT', 'ACKNOWLEDGED', 'TIMEOUT', 'FAILED'). Index: `CREATE INDEX idx_command_device ON COMMAND (device_id, sent_at DESC);`.
  - **CHECK liên trường** giữa `command_type` và `command_value`:
    ```sql
    CHECK (
      (command_type = 'PWM' AND command_value IS NOT NULL AND command_value BETWEEN 0 AND 100)
      OR
      (command_type IN ('ON', 'OFF') AND command_value IS NULL)
    )
    ```
    Lưu ý: phải có `command_value IS NOT NULL` tường minh ở nhánh `PWM`, vì trong PostgreSQL một CHECK cho kết quả NULL (unknown) vẫn được chấp nhận — nếu thiếu, lệnh `PWM` với `command_value = NULL` sẽ lọt qua constraint.
  - *Lý do/Rationale:* Ràng buộc `ON DELETE RESTRICT` bảo vệ dữ liệu audit của hệ thống, cấm xóa cứng thiết bị khi đã vận hành; Index phục vụ tra cứu lịch sử command của thiết bị (chưa có endpoint REST công khai cho việc này — xem `API_SPEC.md`). `command_value` dùng `SMALLINT` thống nhất với `TELEMETRY.pwm`; cả hai cùng thang phần trăm nên không cần bước quy đổi.

## 9. ALERT

- **Table name:** `ALERT`
- **Purpose:** Lưu cảnh báo phát sinh trong hệ thống (ví dụ LAMP_FAULT, DEVICE_OFFLINE).
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `alert_id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Khóa chính UUID |
| `device_id` | VARCHAR(50) | NOT NULL, REFERENCES DEVICE(device_id) ON DELETE RESTRICT | Thiết bị phát sinh cảnh báo |
| `alert_type` | VARCHAR(30) | NOT NULL, CHECK (alert_type IN ('LAMP_FAULT', 'DEVICE_OFFLINE')) | Loại cảnh báo (chỉ hai loại có logic phát hiện trong phạm vi hiện tại) |
| `severity` | VARCHAR(20) | NOT NULL DEFAULT 'MEDIUM', CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) | Mức độ nghiêm trọng |
| `message` | TEXT | NOT NULL | Nội dung cảnh báo |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'NEW', CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')) | Trạng thái xử lý |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo cảnh báo |
| `acknowledged_at` | TIMESTAMPTZ | NULL | Thời điểm xác nhận |
| `resolved_at` | TIMESTAMPTZ | NULL | Thời điểm giải quyết |
| `acknowledged_by` | UUID | NULL, REFERENCES users(user_id) ON DELETE SET NULL | Người xác nhận |
| `resolved_by` | UUID | NULL, REFERENCES users(user_id) ON DELETE SET NULL | Người giải quyết |

- **Primary key:** `alert_id`
- **Foreign keys:** `device_id` → `DEVICE.device_id` (**ON DELETE RESTRICT** — ngăn xóa cứng thiết bị khi còn cảnh báo); `acknowledged_by` → `users.user_id` (ON DELETE SET NULL); `resolved_by` → `users.user_id` (ON DELETE SET NULL).
- **Relationships:** thuộc về 1 `DEVICE`; liên kết tới `users` qua `acknowledged_by`/`resolved_by` (1:N mỗi chiều)
- **Constraints & Indexes: [ĐÃ BỔ SUNG]** CHECK ràng buộc `alert_type`, `severity`, `status`. Index: `CREATE INDEX idx_alert_status ON ALERT (status);`.
  - *Lý do/Rationale:* Ràng buộc `ON DELETE RESTRICT` giữ lại toàn vẹn hồ sơ cảnh báo sự cố kỹ thuật; Index theo `status` giúp tối ưu truy vấn danh sách cảnh báo chưa xử lý trên Dashboard.

## 10. AUDIT_LOG

- **Table name:** `AUDIT_LOG`
- **Purpose:** Ghi lại các thao tác quan trọng trong hệ thống phục vụ truy vết.
- **Columns: [ĐÃ BỔ SUNG]**

| Column | Data Type | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `log_id` | BIGSERIAL | PRIMARY KEY | Khóa chính tăng tự động |
| `user_id` | UUID | NULL, REFERENCES users(user_id) ON DELETE SET NULL | Người thực hiện hành động |
| `device_id` | VARCHAR(50) | NULL, REFERENCES DEVICE(device_id) ON DELETE SET NULL | Thiết bị liên quan (nếu có) |
| `action` | VARCHAR(50) | NOT NULL | Mã hành động |
| `description` | TEXT | NULL | Mô tả chi tiết hành động |
| `ip_address` | VARCHAR(45) | NULL | Địa chỉ IP (hỗ trợ IPv4/IPv6) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm ghi log |

- **Primary key:** `log_id`
- **Foreign keys:** `user_id` → `users.user_id` (ON DELETE SET NULL); `device_id` → `DEVICE.device_id` (ON DELETE SET NULL).
- **Relationships:** thuộc về 1 `users` và (tùy chọn) 1 `DEVICE`
- **Constraints & Indexes: [ĐÃ BỔ SUNG]** `device_id` và `user_id` là optional (cho phép NULL để phục vụ thao tác hệ thống hoặc khi user/device bị xoá nhưng audit log vẫn được bảo lưu). Index: `CREATE INDEX idx_audit_created_at ON AUDIT_LOG (created_at DESC);`.
  - *Lý do/Rationale:* Thiết kế khóa ngoại `ON DELETE SET NULL` là nguyên tắc bắt buộc cho bảng Audit để không bao giờ bị mất dấu vết thao tác lịch sử.

- **Giá trị `action` hợp lệ: [ĐÃ BỔ SUNG]** kiểm tra ở tầng ứng dụng (ví dụ TypeScript union/const), **không** tạo PostgreSQL ENUM:

| Nhóm | action |
|---|---|
| Auth | `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `CHANGE_PASSWORD` |
| User | `CREATE_USER`, `UPDATE_USER`, `LOCK_USER`, `UNLOCK_USER` |
| Device | `CREATE_DEVICE`, `UPDATE_DEVICE`, `CHANGE_DEVICE_LIFECYCLE`, `UPDATE_DEVICE_ACCESS`, `UPDATE_ADAPTIVE_CONFIG` |
| Command | `SEND_COMMAND` |
| Alert | `ACK_ALERT`, `RESOLVE_ALERT` |

  - `PATCH /users/:id/status` ghi `LOCK_USER` khi `status = LOCKED` và `UNLOCK_USER` khi `status = ACTIVE`.
  - `description` **không được chứa** mật khẩu, token hay `device_key`.
  - Thêm action mới phải cập nhật bảng này.

## 11. Relationships (tổng hợp)

| Quan hệ | Cardinality |
|---|---|
| ROLE → users | 1:N |
| users → DEVICE | 1:N (qua `assigned_user_id`) |
| DEVICE → TELEMETRY | 1:N |
| DEVICE → COMMAND | 1:N |
| users → COMMAND | 1:N |
| DEVICE → ALERT | 1:N |
| users → ALERT | 1:N (qua `acknowledged_by` / `resolved_by`) |
| users → AUDIT_LOG | 1:N |
| DEVICE → AUDIT_LOG | 1:N |
| users → DEVICE_ACCESS | 1:N |
| DEVICE → DEVICE_ACCESS | 1:N |

## 12. ERD

```mermaid
erDiagram
    ROLE ||--o{ users : has
    users ||--o{ DEVICE : "assigned_user_id"
    DEVICE ||--o{ TELEMETRY : generates
    DEVICE ||--o{ COMMAND : receives
    users ||--o{ COMMAND : sends
    DEVICE ||--o{ ALERT : triggers
    users ||--o{ ALERT : "acknowledged_by / resolved_by"
    users ||--o{ AUDIT_LOG : performs
    DEVICE ||--o{ AUDIT_LOG : "related to"
    users ||--o{ DEVICE_ACCESS : "granted access"
    DEVICE ||--o{ DEVICE_ACCESS : "accessible by"

    ROLE {
        pk role_id
        role_name
        description
    }
    users {
        pk user_id
        username
        email
        password_hash
        fk role_id
        status
        created_at
        updated_at
    }
    DEVICE {
        pk device_id
        device_name
        location
        fk assigned_user_id
        device_status
        lifecycle_status
        firmware_version
        credential_hash
        adaptive_config
        last_seen_at
        created_at
        updated_at
    }
    TELEMETRY {
        pk telemetry_id
        fk device_id
        timestamp
        lux
        motion
        voltage
        current
        power
        pwm
    }
    COMMAND {
        pk command_id
        fk device_id
        fk user_id
        command_type
        command_value
        status
        sent_at
        ack_at
        result
    }
    ALERT {
        pk alert_id
        fk device_id
        alert_type
        severity
        message
        status
        created_at
        acknowledged_at
        resolved_at
        fk acknowledged_by
        fk resolved_by
    }
    AUDIT_LOG {
        pk log_id
        fk user_id
        fk device_id
        action
        description
        ip_address
        created_at
    }
    DEVICE_ACCESS {
        pk_fk user_id
        pk_fk device_id
        fk granted_by
        created_at
    }
```

> **[ĐÃ BỔ SUNG]** Toàn bộ data type SQL cụ thể, thang đo PWM ($0 - 100\%$), index hiệu năng, cascade behavior (`ON DELETE RESTRICT` cho cả `TELEMETRY`/`COMMAND`/`ALERT` để bảo vệ dữ liệu audit — nhất quán một chính sách duy nhất, `ON DELETE SET NULL` cho User, soft-delete qua `DECOMMISSIONED` cho Device) và các ràng buộc (CHECK, NOT NULL, UNIQUE) của 8 bảng đã được chuẩn hóa chi tiết ở trên để sẵn sàng viết file migration cho PostgreSQL 18. Không tự ý thêm bất kỳ bảng nào ngoài 8 entity này.
