# API_SPEC — Smart Lighting System

> Đây là **communication contract** của hệ thống. Agent khi viết frontend/backend/firmware phải tham khảo file này. Không tự ý thay đổi endpoint, topic hoặc payload structure nếu không có chỉ dẫn rõ ràng — mọi thay đổi phải được phản ánh ngược lại vào file này (xem `PROJECT-RULES.md` mục Documentation Rules).

---

## Quy ước chung về lỗi và phạm vi truy cập [ĐÃ BỔ SUNG]

### Format lỗi REST

Mọi response lỗi (4xx/5xx) dùng cùng một cấu trúc:

```json
{
  "code": "DEVICE_NOT_FOUND",
  "message": "Không tìm thấy thiết bị",
  "details": null
}
```

- `code`: mã lỗi ổn định, chữ hoa, tiếng Anh (client dựa vào `code`, không dựa vào `message`).
- `message`: mô tả cho người dùng, tiếng Việt.
- `details`: `null` hoặc đối tượng/mảng bổ sung (ví dụ danh sách field lỗi khi `VALIDATION_ERROR`).

| HTTP | `code` | Dùng khi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Payload/query sai định dạng hoặc giá trị |
| 400 | `INVALID_LIFECYCLE_TRANSITION` | Chuyển vòng đời không hợp lệ |
| 401 | `UNAUTHORIZED` | Thiếu/sai/hết hạn token |
| 401 | `INVALID_CREDENTIALS` | Sai username/mật khẩu |
| 403 | `FORBIDDEN` | Không đủ quyền theo role |
| 403 | `ACCOUNT_LOCKED` | Tài khoản bị khóa |
| 404 | `NOT_FOUND` hoặc `<RESOURCE>_NOT_FOUND` (ví dụ `DEVICE_NOT_FOUND`) | Không tồn tại **hoặc** không có quyền truy cập thiết bị |
| 409 | `CONFLICT` hoặc mã cụ thể (`USERNAME_EXISTS`, `DEVICE_EXISTS`, `DEVICE_NOT_AVAILABLE`) | Xung đột trạng thái/dữ liệu |
| 500 | `INTERNAL_ERROR` | Lỗi không xác định (không lộ stack trace) |

Các mục "Error cases" bên dưới chỉ ghi mã HTTP; `code` cụ thể theo bảng này.

### Phạm vi truy cập thiết bị (device scope)

- **Admin:** truy cập mọi thiết bị.
- **Operator/Viewer:** chỉ truy cập thiết bị có bản ghi trong `DEVICE_ACCESS` (xem `DATABASE.md` mục 6A).
- Áp dụng cho mọi endpoint liên quan thiết bị và dữ liệu của thiết bị: `/devices/*`, `/alerts/*`, `/dashboard/*` và event Socket.IO.
- Endpoint theo một thiết bị cụ thể (`/devices/:id/...`, `/alerts/:id/...`): không có quyền → `404` (không lộ việc thiết bị có tồn tại).
- Endpoint danh sách (`GET /devices`, `GET /alerts`, `/dashboard/*`): chỉ trả/tính các thiết bị được phép; `GET /alerts?device_id=` với thiết bị không có quyền trả danh sách rỗng.
- **Thứ tự kiểm tra:** xác thực token (`401`) → role (`403`) → phạm vi thiết bị (`404`) → validate dữ liệu (`400`) → trạng thái (`409`). Ví dụ: Viewer gọi `POST /devices/:id/commands` luôn nhận `403`, kể cả thiết bị không thuộc phạm vi của họ.
- *Lý do/Rationale:* đáp ứng yêu cầu người dùng chỉ truy cập thiết bị và dữ liệu thuộc phạm vi được cấp quyền; thứ tự kiểm tra cố định để test RBAC cho kết quả ổn định.

---

## Phần A — REST API

Quy ước chung: "Quyền" (Authorization) lấy theo bảng mục 3.3.3 của báo cáo gốc. "All" nghĩa là mọi user đã đăng nhập (Admin/Operator/Viewer) đều được gọi. **[ĐÃ BỔ SUNG]** Với endpoint liên quan thiết bị, Operator/Viewer chỉ truy cập thiết bị được cấp quyền (xem "Quy ước chung về lỗi và phạm vi truy cập" ở trên); các `404` ở mục "Error cases" bao gồm cả trường hợp không có quyền truy cập thiết bị.

### A.1 Authentication

#### `POST /auth/login`
- **Authentication:** Public (không cần token)
- **Authorization:** Public
- **Purpose:** Đăng nhập hệ thống
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "username": "admin",
    "password": "Password123@"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK` (Đồng thời server set HttpOnly Cookie `refreshToken`)
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "user_id": "c3b88939-2a94-4d47-9759-338276f50b4a",
      "username": "admin",
      "email": "admin@smartlighting.local",
      "role": "ADMIN"
    }
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: Thiếu username hoặc password.
  - `401 Unauthorized`: Sai tên đăng nhập hoặc mật khẩu.
  - `403 Forbidden`: Tài khoản đang bị khóa (`status = 'LOCKED'`).
- *Lý do/Rationale:* Cần thiết để lập trình form đăng nhập Frontend và middleware xác thực Backend.

#### `POST /auth/refresh`
- **Authentication:** Public (xác thực qua HttpOnly Cookie chứa refresh token)
- **Authorization:** Tất cả vai trò
- **Purpose:** Cấp mới Access Token khi token cũ hết hạn
- **Request: [ĐÃ BỔ SUNG]** `{}` (Trình duyệt tự động gửi kèm HttpOnly Cookie `refreshToken`)
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "Bearer",
    "expires_in": 900
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`: Refresh token thiếu, không hợp lệ hoặc đã hết hạn (buộc người dùng đăng nhập lại).
- *Lý do/Rationale:* Bắt buộc phải có để hiện thực hóa cơ chế Access Token (ngắn hạn 15 phút) kết hợp Refresh Token (dài hạn 7 ngày trong HttpOnly Cookie) theo đúng `PROJECT-RULES.md`, phục vụ lập trình interceptor tự động refresh token ở Frontend.

#### `POST /auth/logout`
- **Authentication:** Authenticated (yêu cầu Bearer token)
- **Authorization:** Tất cả vai trò
- **Purpose:** Đăng xuất
- **Request: [ĐÃ BỔ SUNG]** `{}` (Header: `Authorization: Bearer <token>`)
- **Response: [ĐÃ BỔ SUNG]** `200 OK` (Xóa HttpOnly Cookie `refreshToken`)
  ```json
  {
    "message": "Đăng xuất thành công"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`: Token không hợp lệ.
- *Lý do/Rationale:* Cần thiết để xóa phiên làm việc và thu hồi cookie refresh token.

#### `PUT /auth/password`
- **Authentication:** Authenticated
- **Authorization:** Tất cả vai trò (trên tài khoản của chính mình)
- **Purpose:** Đổi mật khẩu
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "current_password": "OldPassword123@",
    "new_password": "NewSecurePassword456@"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "message": "Đổi mật khẩu thành công"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: Mật khẩu mới không đủ độ phức tạp (tối thiểu 8 ký tự, gồm chữ và số) hoặc trùng mật khẩu cũ.
  - `401 Unauthorized`: Mật khẩu hiện tại không chính xác.
- *Lý do/Rationale:* Cần thiết để xây dựng form đổi mật khẩu và validate logic ở backend.

### A.2 Users

#### `GET /users`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Danh sách User
- **Request: [ĐÃ BỔ SUNG]** Query params: `limit` (mặc định 20), `offset` (mặc định 0).
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "data": [
      {
        "user_id": "c3b88939-2a94-4d47-9759-338276f50b4a",
        "username": "admin",
        "email": "admin@smartlighting.local",
        "role_id": 1,
        "role_name": "ADMIN",
        "status": "ACTIVE",
        "created_at": "2026-09-26T00:00:00Z"
      }
    ],
    "total": 1
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`, `403 Forbidden` (khi không phải Admin).
- *Lý do/Rationale:* Cần thiết để render bảng quản lý người dùng ở trang Admin.

#### `POST /users`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Tạo User
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "username": "operator01",
    "email": "operator01@smartlighting.local",
    "password": "InitialPassword123@",
    "role_id": 2
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `201 Created`
  ```json
  {
    "user_id": "e4f8910a-6e54-4601-8fb7-bf532670e5b9",
    "username": "operator01",
    "email": "operator01@smartlighting.local",
    "role_id": 2,
    "status": "ACTIVE",
    "created_at": "2026-09-26T08:30:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: Thiếu trường bắt buộc hoặc role_id không hợp lệ.
  - `409 Conflict`: Username hoặc email đã tồn tại.
- *Lý do/Rationale:* Cần thiết để tạo tài khoản mới trong chức năng User Management.

#### `PUT /users/:id`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Cập nhật User
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "email": "new_email@smartlighting.local",
    "role_id": 2
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "user_id": "e4f8910a-6e54-4601-8fb7-bf532670e5b9",
    "username": "operator01",
    "email": "new_email@smartlighting.local",
    "role_id": 2,
    "updated_at": "2026-09-26T08:35:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `400 Bad Request`, `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để cập nhật thông tin người dùng.

#### `PATCH /users/:id/status`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Khóa/mở User
- **Request: [ĐÃ BỔ SUNG]** (`status` chỉ nhận `ACTIVE` hoặc `LOCKED`)
  ```json
  {
    "status": "LOCKED"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "user_id": "e4f8910a-6e54-4601-8fb7-bf532670e5b9",
    "status": "LOCKED",
    "updated_at": "2026-09-26T08:36:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `400 Bad Request` (status không phải `ACTIVE`/`LOCKED`), `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để lập trình nút bấm khóa/mở tài khoản trên UI.

### A.3 Devices

#### `GET /devices`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Danh sách thiết bị
- **Request: [ĐÃ BỔ SUNG]** Query params (tùy chọn): `status` (ONLINE/OFFLINE/FAULT), `lifecycle` (REGISTERED/PROVISIONED/ACTIVE/MAINTENANCE/DECOMMISSIONED), `limit` (mặc định 20), `offset` (mặc định 0).
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "data": [
      {
        "device_id": "LIGHT-001",
        "device_name": "Living Room Light",
        "location": "Room 101",
        "assigned_user_id": "c3b88939-2a94-4d47-9759-338276f50b4a",
        "device_status": "ONLINE",
        "lifecycle_status": "ACTIVE",
        "firmware_version": "1.0.0",
        "last_seen_at": "2026-09-26T08:30:00Z",
        "created_at": "2026-09-26T00:00:00Z"
      }
    ],
    "total": 1
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`.
- *Lý do/Rationale:* Cần thiết để hiển thị bảng danh sách thiết bị trên giao diện quản trị và bộ lọc trạng thái.

#### `POST /devices`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Onboarding thiết bị mới
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "device_id": "LIGHT-001",
    "device_name": "Living Room Light",
    "location": "Room 101",
    "assigned_user_id": "c3b88939-2a94-4d47-9759-338276f50b4a"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `201 Created`
  ```json
  {
    "device_id": "LIGHT-001",
    "device_name": "Living Room Light",
    "lifecycle_status": "REGISTERED",
    "device_key": "sec_dev_9a4f2e18b0c8d19e...",
    "created_at": "2026-09-26T08:30:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: Thiếu `device_id` hoặc `device_name`.
  - `409 Conflict`: `device_id` đã tồn tại trong hệ thống.
- *Lý do/Rationale:* Cần thiết để tạo bản ghi thiết bị và sinh khóa bảo mật `device_key` cấp phát cho firmware ESP32.

> **Quan hệ `device_key` ↔ `credential_hash` [ĐÃ BỔ SUNG]:**
> - `device_key` trả về trong response trên là **secret dạng plaintext, chỉ hiển thị một lần duy nhất** tại thời điểm onboarding, dùng để cấu hình MQTT credential khi nạp firmware ESP32. Không có endpoint nào cho phép xem lại `device_key` sau này.
> - Backend băm `device_key` bằng **bcryptjs** (cost factor = 10, xem `PROJECT-RULES.md` mục 8) và lưu kết quả vào `DEVICE.credential_hash`. Không bao giờ lưu `device_key` dạng plaintext trong DB.
> - **Xác thực MQTT:** `device_key` là credential ESP32 dùng để kết nối MQTT (kèm `device_id`). Cơ chế broker/backend xác thực credential này khớp với `credential_hash` đã lưu là **TODO/UNDEFINED** — chưa quyết định chi tiết (ví dụ: auth plugin cho Mosquitto, hoặc lớp xác thực trung gian). Không giả định Mosquitto tự động so khớp bcrypt hash, vì đây không phải hành vi mặc định của broker.

#### `GET /devices/:id`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Chi tiết thiết bị
- **Request: [ĐÃ BỔ SUNG]** None
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "device_id": "LIGHT-001",
    "device_name": "Living Room Light",
    "location": "Room 101",
    "assigned_user_id": "c3b88939-2a94-4d47-9759-338276f50b4a",
    "device_status": "ONLINE",
    "lifecycle_status": "ACTIVE",
    "firmware_version": "1.0.0",
    "adaptive_config": {
      "enabled": true,
      "motion_timeout_sec": 30,
      "lux_thresholds": [
        { "min_lux": 400, "pwm": 30 },
        { "min_lux": 200, "pwm": 50 },
        { "min_lux": 100, "pwm": 70 },
        { "min_lux": 0, "pwm": 100 }
      ],
      "no_motion_pwm": 10
    },
    "last_seen_at": "2026-09-26T08:30:00Z",
    "created_at": "2026-09-26T00:00:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`, `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để render màn hình chi tiết thiết bị và cấu hình Adaptive Lighting hiện tại.

#### `PUT /devices/:id`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Cập nhật thiết bị
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "device_name": "Living Room Main Light",
    "location": "Room 102",
    "assigned_user_id": "c3b88939-2a94-4d47-9759-338276f50b4a"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "device_id": "LIGHT-001",
    "device_name": "Living Room Main Light",
    "location": "Room 102",
    "updated_at": "2026-09-26T08:35:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `400 Bad Request`, `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để cập nhật vị trí lắp đặt và tên gọi gợi nhớ của thiết bị.

#### `PATCH /devices/:id/lifecycle`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Đổi trạng thái vòng đời (`lifecycle_status`) — xem `ARCHITECTURE.md` mục Device Lifecycle
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "lifecycle_status": "ACTIVE"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "device_id": "LIGHT-001",
    "lifecycle_status": "ACTIVE",
    "updated_at": "2026-09-26T08:35:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: Chuyển đổi trạng thái không hợp lệ (ví dụ: chuyển ngược từ `DECOMMISSIONED`).
  - `404 Not Found`: Không tìm thấy thiết bị.
- *Lý do/Rationale:* Cần thiết để lập trình logic state machine chuyển đổi vòng đời thiết bị.
- **Hành vi MQTT: [ĐÃ BỔ SUNG]** quyền kết nối MQTT phụ thuộc `lifecycle_status` (xem B.7). Khi chuyển sang `MAINTENANCE` hoặc `DECOMMISSIONED`, backend phải ngắt kết nối hiện tại của thiết bị (cơ chế cụ thể: **TODO/UNDEFINED**, xem B.7); thiết bị đã `DECOMMISSIONED` không thể chuyển lại.

#### `PATCH /devices/:id/config`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Cấu hình Adaptive Lighting (`adaptive_config`)
- **Request: [ĐÃ BỔ SUNG]** (Thang đo PWM: phần trăm 0–100%)
  ```json
  {
    "adaptive_config": {
      "enabled": true,
      "motion_timeout_sec": 30,
      "lux_thresholds": [
        { "min_lux": 400, "pwm": 30 },
        { "min_lux": 200, "pwm": 50 },
        { "min_lux": 100, "pwm": 70 },
        { "min_lux": 0, "pwm": 100 }
      ],
      "no_motion_pwm": 10
    }
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "device_id": "LIGHT-001",
    "adaptive_config": {
      "enabled": true,
      "motion_timeout_sec": 30,
      "lux_thresholds": [
        { "min_lux": 400, "pwm": 30 },
        { "min_lux": 200, "pwm": 50 },
        { "min_lux": 100, "pwm": 70 },
        { "min_lux": 0, "pwm": 100 }
      ],
      "no_motion_pwm": 10
    },
    "updated_at": "2026-09-26T08:35:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: Payload sai định dạng hoặc giá trị PWM ngoài dải 0–100%.
  - `404 Not Found`: Không tìm thấy thiết bị.
- *Lý do/Rationale:* Cần thiết để Admin điều chỉnh các ngưỡng ánh sáng tự động từ giao diện Web và đồng bộ xuống ESP32.

#### `GET /devices/:id/access`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Xem danh sách user (Operator/Viewer) được cấp quyền truy cập thiết bị
- **Request: [ĐÃ BỔ SUNG]** None
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "device_id": "LIGHT-001",
    "users": [
      {
        "user_id": "e4f8910a-6e54-4601-8fb7-bf532670e5b9",
        "username": "operator01",
        "role_name": "OPERATOR"
      }
    ]
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`, `403 Forbidden` (không phải Admin), `404 Not Found` (thiết bị không tồn tại).

#### `PUT /devices/:id/access`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Đặt lại toàn bộ danh sách user (Operator/Viewer) được truy cập thiết bị
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "user_ids": ["e4f8910a-6e54-4601-8fb7-bf532670e5b9"]
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK` (cùng dạng response của `GET /devices/:id/access`)
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: `user_ids` sai định dạng, user không tồn tại, hoặc là Admin (Admin luôn có quyền, không cần cấp).
  - `404 Not Found`: Thiết bị không tồn tại.
- **Hành vi: [ĐÃ BỔ SUNG]** thay thế toàn bộ tập bản ghi `DEVICE_ACCESS` của thiết bị; ghi audit `UPDATE_DEVICE_ACCESS`; cập nhật room Socket.IO của các user bị ảnh hưởng (xem Phần C.2).
- *Lý do/Rationale:* Cần thiết để Admin cấp/thu hồi phạm vi truy cập; dùng PUT thay thế toàn bộ để tránh trạng thái cộng dồn khó kiểm soát.

### A.4 Telemetry

#### `GET /devices/:id/telemetry/latest`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Telemetry mới nhất
- **Request: [ĐÃ BỔ SUNG]** None
- **Response: [ĐÃ BỔ SUNG]** `200 OK` (Thang đo `pwm`: phần trăm 0–100%)
  ```json
  {
    "telemetry_id": 1001,
    "device_id": "LIGHT-001",
    "timestamp": "2026-09-26T08:30:00Z",
    "lux": 185.2,
    "motion": true,
    "voltage": 12.1,
    "current": 0.72,
    "power": 8.71,
    "pwm": 65
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `404 Not Found`: Thiết bị không tồn tại hoặc chưa có telemetry.
- *Lý do/Rationale:* Cần thiết để widget trạng thái thời gian thực hiển thị dữ liệu ngay khi tải trang.

#### `GET /devices/:id/telemetry`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Lịch sử telemetry
- **Request: [ĐÃ BỔ SUNG]** Query params: `from` (ISO datetime), `to` (ISO datetime), `limit` (mặc định 100, tối đa 1000).
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "device_id": "LIGHT-001",
    "data": [
      {
        "telemetry_id": 1001,
        "timestamp": "2026-09-26T08:30:00Z",
        "lux": 185.2,
        "motion": true,
        "voltage": 12.1,
        "current": 0.72,
        "power": 8.71,
        "pwm": 65
      }
    ],
    "total": 1
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `400 Bad Request` (sai định dạng thời gian), `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để vẽ biểu đồ lịch sử cảm biến và điện năng bằng Recharts.

### A.5 Commands

#### `POST /devices/:id/commands`
- **Authentication:** Authenticated
- **Authorization:** Admin/Operator (Viewer bị từ chối)
- **Purpose:** Điều khiển thiết bị (gửi command, ví dụ ON/OFF/PWM)
- **Request: [ĐÃ BỔ SUNG]** (`command_value`: **số nguyên** phần trăm 0–100, bắt buộc khi `command_type = "PWM"`; phải bỏ trống/`null` khi `ON`/`OFF`)
  ```json
  {
    "command_type": "PWM",
    "command_value": 70
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `202 Accepted`
  ```json
  {
    "command_id": "8f03c2aa-9f01-4475-8025-a134a6efef12",
    "device_id": "LIGHT-001",
    "command_type": "PWM",
    "command_value": 70,
    "status": "PENDING",
    "sent_at": "2026-09-26T08:30:05Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]**
  - `400 Bad Request`: `command_type` không hợp lệ (chỉ nhận `PWM`, `ON`, `OFF`); `command_value` không phải số nguyên trong dải 0–100; thiếu `command_value` khi `PWM`; hoặc có `command_value` khi `ON`/`OFF`.
  - `403 Forbidden`: Người dùng vai trò `Viewer` gọi endpoint này bị từ chối (theo TC09).
  - `404 Not Found`: Không tìm thấy thiết bị.
  - `409 Conflict` (`DEVICE_NOT_AVAILABLE`): Thiết bị đang `OFFLINE` hoặc `lifecycle_status` khác `ACTIVE` (`REGISTERED`, `PROVISIONED`, `MAINTENANCE`, `DECOMMISSIONED`).
- *Lý do/Rationale:* Cần thiết để lập trình bảng điều khiển slider PWM và công tắc bật/tắt đèn trên Web UI. Mã HTTP `202 Accepted` phản ánh đúng tính chất bất đồng bộ của lệnh MQTT IoT: kết quả cuối (`ACKNOWLEDGED`/`FAILED`/`TIMEOUT`) được cập nhật sau vào `COMMAND.status` theo `B.6`. Hiện chưa có endpoint REST để tra cứu trạng thái/lịch sử lệnh: **TODO/UNDEFINED** (không tự thêm khi chưa được xác nhận).

### A.6 Alerts

#### `GET /alerts`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Danh sách cảnh báo
- **Request: [ĐÃ BỔ SUNG]** Query params: `status` (`NEW`, `ACKNOWLEDGED`, `RESOLVED`), `device_id`, `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `limit` (mặc định 50), `offset` (0).
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "data": [
      {
        "alert_id": "b714fa51-6fc7-4581-995b-06410313f87b",
        "device_id": "LIGHT-001",
        "alert_type": "LAMP_FAULT",
        "severity": "HIGH",
        "message": "Đèn bật (PWM >= 30%) nhưng dòng điện tiêu thụ đo được dưới ngưỡng 0.05A trong hơn 5 giây",
        "status": "NEW",
        "created_at": "2026-09-26T08:29:00Z"
      }
    ],
    "total": 1
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`.
- *Lý do/Rationale:* Cần thiết để hiển thị bảng danh sách cảnh báo trên UI.

#### `PATCH /alerts/:id/acknowledge`
- **Authentication:** Authenticated
- **Authorization:** Admin/Operator
- **Purpose:** Xác nhận cảnh báo
- **Request: [ĐÃ BỔ SUNG]** `{}` (Body rỗng)
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "alert_id": "b714fa51-6fc7-4581-995b-06410313f87b",
    "status": "ACKNOWLEDGED",
    "acknowledged_at": "2026-09-26T08:31:00Z",
    "acknowledged_by": "c3b88939-2a94-4d47-9759-338276f50b4a"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `403 Forbidden` (Viewer không có quyền), `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để người vận hành bấm nút xác nhận sự cố.

#### `PATCH /alerts/:id/resolve`
- **Authentication:** Authenticated
- **Authorization:** Admin/Operator
- **Purpose:** Xử lý (giải quyết) cảnh báo
- **Request: [ĐÃ BỔ SUNG]**
  ```json
  {
    "note": "Đã kiểm tra và thay thế dải LED 12V mới"
  }
  ```
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "alert_id": "b714fa51-6fc7-4581-995b-06410313f87b",
    "status": "RESOLVED",
    "resolved_at": "2026-09-26T08:32:00Z",
    "resolved_by": "c3b88939-2a94-4d47-9759-338276f50b4a"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `403 Forbidden` (Viewer không có quyền), `404 Not Found`.
- *Lý do/Rationale:* Cần thiết để đóng sự cố sau khi sửa chữa xong.

### A.7 Dashboard

#### `GET /dashboard/summary`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Tổng quan dashboard
- **Request: [ĐÃ BỔ SUNG]** None
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "devices": {
      "total": 1,
      "online": 1,
      "offline": 0,
      "fault": 0
    },
    "alerts": {
      "active_count": 0,
      "resolved_today": 1
    },
    "avg_power_watts": 8.71,
    "system_status": "HEALTHY",
    "updated_at": "2026-09-26T08:30:00Z"
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`.
- *Lý do/Rationale:* Cần thiết để hiển thị các thẻ KPI thống kê trên màn hình chính Dashboard.

#### `GET /dashboard/devices`
- **Authentication:** Authenticated
- **Authorization:** All
- **Purpose:** Trạng thái thiết bị (dùng cho dashboard)
- **Request: [ĐÃ BỔ SUNG]** None
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "data": [
      {
        "device_id": "LIGHT-001",
        "device_name": "Living Room Light",
        "device_status": "ONLINE",
        "lux": 185.2,
        "motion": true,
        "pwm": 65,
        "power": 8.71,
        "last_seen_at": "2026-09-26T08:30:00Z"
      }
    ]
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`.
- *Lý do/Rationale:* Cần thiết để hiển thị danh sách thẻ thiết bị rút gọn trên Dashboard.

### A.8 Audit

#### `GET /audit-logs`
- **Authentication:** Authenticated
- **Authorization:** Admin
- **Purpose:** Xem audit log
- **Request: [ĐÃ BỔ SUNG]** Query params: `user_id`, `action`, `limit` (mặc định 50), `offset` (0).
- **Response: [ĐÃ BỔ SUNG]** `200 OK`
  ```json
  {
    "data": [
      {
        "log_id": 1,
        "user_id": "c3b88939-2a94-4d47-9759-338276f50b4a",
        "device_id": "LIGHT-001",
        "action": "SEND_COMMAND",
        "description": "Gửi lệnh PWM 70% xuống thiết bị LIGHT-001",
        "ip_address": "192.168.1.50",
        "created_at": "2026-09-26T08:30:05Z"
      }
    ],
    "total": 1
  }
  ```
- **Error cases: [ĐÃ BỔ SUNG]** `401 Unauthorized`, `403 Forbidden` (chỉ Admin).
- *Lý do/Rationale:* Cần thiết để phục vụ trang xem nhật ký hoạt động hệ thống.

---

## Phần B — MQTT

### B.1 Topic Structure

| Topic | Chiều | Mục đích |
|---|---|---|
| `iot/device/{device_id}/telemetry` | ESP32 → Backend | Dữ liệu cảm biến |
| `iot/device/{device_id}/status` | ESP32 → Backend | Heartbeat / trạng thái online |
| `iot/device/{device_id}/command` | Backend → ESP32 | Lệnh điều khiển |
| `iot/device/{device_id}/ack` | ESP32 → Backend | ACK phản hồi lệnh |
| `iot/device/{device_id}/config` | Backend → ESP32 | Cấu hình (Adaptive Lighting) |

> Chỉ có 5 topic trên. Cảnh báo (alert) **không** có topic MQTT riêng — xem `ARCHITECTURE.md` mục 6.3.

### B.2 Chi tiết từng topic

#### `iot/device/{device_id}/telemetry`
- **Publisher:** ESP32
- **Subscriber:** Backend
- **Direction:** ESP32 → Backend
- **Purpose:** Gửi dữ liệu cảm biến định kỳ (lux, motion, điện năng, pwm hiện tại).
- **Payload:** xem mục B.3.

#### `iot/device/{device_id}/status`
- **Publisher:** ESP32
- **Subscriber:** Backend
- **Direction:** ESP32 → Backend
- **Purpose:** Heartbeat / báo trạng thái online, dùng để backend phát hiện `DEVICE_OFFLINE` khi timeout.
- **Payload: [ĐÃ BỔ SUNG]**
  ```json
  {
    "device_id": "LIGHT-001",
    "status": "ONLINE",
    "uptime_seconds": 3600,
    "firmware_version": "1.0.0",
    "free_heap": 182400,
    "wifi_rssi": -65,
    "timestamp": "2026-09-26T08:30:00Z"
  }
  ```
- *Lý do/Rationale:* Cần thiết để firmware gửi heartbeat định kỳ và backend cập nhật `last_seen_at`.

#### `iot/device/{device_id}/command`
- **Publisher:** Backend
- **Subscriber:** ESP32
- **Direction:** Backend → ESP32
- **Purpose:** Gửi lệnh điều khiển (bật/tắt, PWM) xuống thiết bị.
- **Payload:** xem mục B.4.

#### `iot/device/{device_id}/ack`
- **Publisher:** ESP32
- **Subscriber:** Backend
- **Direction:** ESP32 → Backend
- **Purpose:** Phản hồi xác nhận đã thực hiện lệnh.
- **Payload:** xem mục B.5.

#### `iot/device/{device_id}/config`
- **Publisher:** Backend
- **Subscriber:** ESP32
- **Direction:** Backend → ESP32
- **Purpose:** Đẩy cấu hình Adaptive Lighting (`adaptive_config`) xuống thiết bị.
- **Payload: [ĐÃ BỔ SUNG]** (Thang đo PWM: phần trăm 0–100%)
  ```json
  {
    "config_version": 1,
    "enabled": true,
    "motion_timeout_sec": 30,
    "lux_thresholds": [
      { "min_lux": 400, "pwm": 30 },
      { "min_lux": 200, "pwm": 50 },
      { "min_lux": 100, "pwm": 70 },
      { "min_lux": 0, "pwm": 100 }
    ],
    "no_motion_pwm": 10,
    "timestamp": "2026-09-26T08:30:00Z"
  }
  ```
- *Lý do/Rationale:* Cần thiết để parse JSON trên ESP32 (dùng ArduinoJson) và lưu vào NVS/RAM của ESP32.

### B.3 Telemetry Payload

Các field đã xác định (theo ví dụ trong báo cáo gốc, mục 3.2.2):

```json
{
  "device_id": "LIGHT-001",
  "timestamp": "2026-09-26T08:30:00Z",
  "lux": 185.2,
  "motion": true,
  "voltage": 12.1,
  "current": 0.72,
  "power": 8.71,
  "pwm": 65
}
```

| Field | Mô tả |
|---|---|
| `device_id` | Định danh thiết bị |
| `timestamp` | Thời điểm ghi nhận (ISO 8601 UTC) |
| `lux` | Cường độ ánh sáng (từ BH1750) |
| `motion` | Có/không phát hiện chuyển động (từ RCWL-0516) |
| `voltage` | Điện áp đo được (từ INA219) |
| `current` | Dòng điện đo được (từ INA219) |
| `power` | Công suất tiêu thụ (từ INA219) |
| `pwm` | **[ĐÃ BỔ SUNG]** Giá trị PWM hiện tại theo thang đo **phần trăm ($0 - 100\%$)** |

> *Lý do/Rationale:* Chốt thang đo `pwm` là phần trăm ($0 - 100\%$) giúp code telemetry parser ở Backend lưu trực tiếp vào database mà không cần chuyển đổi.

### B.4 Command Payload

```json
{
  "command_id": "8f03c2aa-9f01-4475-8025-a134a6efef12",
  "command_type": "PWM",
  "command_value": 70,
  "timestamp": "2026-09-26T08:30:05Z"
}
```

| Field | Mô tả |
|---|---|
| `command_id` | UUID định danh lệnh |
| `command_type` | Loại lệnh: **[ĐÃ BỔ SUNG]** `"PWM"` (đặt độ sáng cụ thể), `"ON"` (bật đèn — ngữ nghĩa bên dưới), `"OFF"` (tắt đèn, PWM = 0) |
| `command_value` | Giá trị đi kèm lệnh: **[ĐÃ BỔ SUNG]** số nguyên theo thang **phần trăm ($0 - 100\%$)** khi loại lệnh là `PWM`; `null` nếu là `ON`/`OFF` |
| `timestamp` | Thời điểm gửi lệnh (ISO 8601 UTC, dùng để kiểm tra hết hạn tin nhắn ở tầng ứng dụng) |

> *Lý do/Rationale:* Thang đo PWM phần trăm ($0 - 100\%$) và danh sách 3 lệnh chuẩn (`PWM`, `ON`, `OFF`) là bắt buộc phải có để switch-case trong code firmware C++ và validate body ở backend.

**Ngữ nghĩa lệnh (hành vi trên ESP32) — [ĐÃ BỔ SUNG]:**

| Lệnh | Hành vi | Ảnh hưởng `last_manual_pwm` |
|---|---|---|
| `PWM`, giá trị > 0 | Đặt PWM = `command_value` | Cập nhật = `command_value` |
| `PWM`, giá trị = 0 | Đặt PWM = 0 | Không cập nhật |
| `OFF` | Đặt PWM = 0 | Không cập nhật |
| `ON` | Đặt PWM = `last_manual_pwm`; nếu chưa có (chưa từng có lệnh `PWM` > 0 kể từ lần khởi động) thì đặt **100** | Không cập nhật |

- `last_manual_pwm` là biến RAM của ESP32, chỉ ghi nhận mức khác 0 do **lệnh thủ công** đặt; mức do Adaptive Lighting đặt không được ghi nhận. Mất khi ESP32 khởi động lại (khi đó `ON` → 100).
- Mọi lệnh thủ công được thực thi thành công đều bật `manual_override` — quy tắc ghi đè Adaptive Lighting: `ARCHITECTURE.md` mục 7.2.
- Ví dụ: `PWM 70` → `OFF` → `ON` ⇒ 70%. Adaptive đang đặt 10% → `OFF` → `ON` ⇒ 100% (không phải 10%).

### B.5 ACK Payload

```json
{
  "command_id": "8f03c2aa-9f01-4475-8025-a134a6efef12",
  "status": "ACKNOWLEDGED",
  "timestamp": "2026-09-26T08:30:05.150Z",
  "result": "PWM_SET"
}
```

| Field | Mô tả |
|---|---|
| `command_id` | UUID của lệnh được xác nhận (khớp với Command Payload) |
| `status` | Trạng thái ACK: **[ĐÃ BỔ SUNG]** `"ACKNOWLEDGED"` (thực thi thành công), `"REJECTED"` (bị từ chối do quá hạn hoặc sai tham số), `"EXECUTION_FAILED"` (lỗi phần cứng ngoại vi) |
| `timestamp` | Thời điểm ACK |
| `result` | Kết quả thực thi (ví dụ: `PWM_SET`, `TURNED_ON`, `TURNED_OFF`, `COMMAND_EXPIRED`) |

> *Lý do/Rationale:* Cần thiết để Backend cập nhật cột `status` và `result` trong bảng `COMMAND` và gửi Socket.IO tới client.

**Ánh xạ ACK → `COMMAND.status` [ĐÃ BỔ SUNG]:**

| Điều kiện | `COMMAND.status` |
|---|---|
| ACK `status = "ACKNOWLEDGED"` | `ACKNOWLEDGED` |
| ACK `status = "REJECTED"` (gồm `COMMAND_EXPIRED`) hoặc `"EXECUTION_FAILED"` | `FAILED` (lý do lưu ở `COMMAND.result`) |
| Không có ACK sau khi hết các lần retry | `TIMEOUT` |
| Publish MQTT thất bại (không gửi được lệnh) | `FAILED` |

### B.6 Các thông số vận hành MQTT đã chuẩn hóa: [ĐÃ BỔ SUNG]

Toàn bộ thông số vận hành giao thức MQTT giữa Backend và ESP32 đã được chuẩn hóa chi tiết:

- **Phiên bản giao thức:** **MQTT v3.1.1** (phiên bản mặc định phổ biến, tương thích tuyệt đối với Eclipse Mosquitto, thư viện MQTT.js trên Node.js và thư viện PubSubClient trên ESP32).
- **Cơ chế Message Expiry (Hết hạn tin nhắn 60 giây):**
  - Do hệ thống sử dụng **MQTT v3.1.1** (vốn không có thuộc tính packet "Message Expiry Interval" như MQTT v5), cơ chế hết hạn tin nhắn được **xử lý hoàn toàn ở tầng ứng dụng (Application Layer)**:
    1. Khi Backend phát lệnh điều khiển qua topic `command`, Backend luôn đính kèm trường `"timestamp"` theo giờ chuẩn ISO 8601 UTC.
    2. ESP32 đồng bộ thời gian thực qua giao thức SNTP khi khởi động. Khi nhận bản tin command từ broker, ESP32 tính độ lệch thời gian $\Delta t = t_{\text{current}} - t_{\text{command}}$.
    3. Nếu $\Delta t > 60\text{ giây}$, ESP32 xác định lệnh đã hết hạn (do bị kẹt trên broker lúc mất mạng trước đó), từ chối thực thi điều khiển LED và gửi bản tin ACK với `status: "REJECTED"`, `result: "COMMAND_EXPIRED"`.
  - *Lý do/Rationale:* Ngăn chặn hiện tượng đèn tự động bật tắt bất thường khi ESP32 online trở lại sau thời gian dài mất mạng nếu trên broker còn tồn đọng lệnh cũ.
- **QoS (Quality of Service):**
  - `iot/device/{device_id}/telemetry`: **QoS 0** (dữ liệu định kỳ 5s/lần, chấp nhận mất gói nhỏ để tránh dồn ứ tin).
  - `iot/device/{device_id}/status`: **QoS 0** cho heartbeat định kỳ 10s/lần; **QoS 1** cho bản tin LWT.
  - `iot/device/{device_id}/command`: **QoS 1** (đảm bảo ít nhất một lần gửi thành công tới MCU).
  - `iot/device/{device_id}/ack`: **QoS 1** (đảm bảo phản hồi lệnh tới Backend).
  - `iot/device/{device_id}/config`: **QoS 1** (đảm bảo cấu hình cập nhật an toàn).
  - *Lý do/Rationale:* Phân loại QoS giúp tối ưu hóa băng thông cho dữ liệu định kỳ tần suất cao (telemetry, heartbeat), đồng thời bảo đảm độ tin cậy tuyệt đối cho các luồng điều khiển và cấu hình.
- **Retain flag:**
  - `retain = false` cho tất cả các bản tin `telemetry`, `command`, `ack`, `config`.
  - `retain = true` duy nhất cho bản tin LWT (Last Will and Testament) của ESP32 thiết lập khi kết nối tới broker Mosquitto:
    - Topic: `iot/device/{device_id}/status`
    - Payload: `{"device_id":"LIGHT-001","status":"OFFLINE","timestamp":"..."}`
    - QoS: 1
  - *Lý do/Rationale:* LWT retain giúp broker tự động thông báo ngay lập tức trạng thái OFFLINE cho Backend khi kết nối TCP của ESP32 bị đứt đột ngột.
- **Retry policy [ĐÃ BỔ SUNG]:** mỗi lần gửi chờ ACK tối đa 5 giây; tối đa 2 lần retry, dùng **cùng `command_id`** ở mọi lần gửi (không tạo `command_id` mới):
  ```text
  Publish lần đầu (PENDING → SENT)
      ↓ chờ ACK 5s
      ↓ chưa có ACK → nghỉ 1s
  Retry #1 (cùng command_id, vẫn SENT)
      ↓ chờ ACK 5s
      ↓ chưa có ACK → nghỉ 2s
  Retry #2 (cùng command_id, vẫn SENT)
      ↓ chờ ACK 5s
      ↓ chưa có ACK
  TIMEOUT
  ```
  Tổng thời gian tối đa khoảng 18 giây. Khoảng nghỉ 1s → 2s là backoff theo cấp số nhân.
  - **Luồng trạng thái `COMMAND.status`:** `PENDING` (REST vừa tạo lệnh, trả `202`) → `SENT` (publish MQTT thành công; retry vẫn là `SENT`) → `ACKNOWLEDGED` / `FAILED` / `TIMEOUT` theo bảng ánh xạ ở mục B.5. Nếu publish MQTT thất bại ngay từ đầu: `PENDING` → `FAILED`.
  - *Lý do/Rationale:* Tránh Backend treo vô hạn và phản hồi kịp thời cho giao diện Web; REST trả `202` ngay nên việc chờ/retry không chặn request. Tổng thời gian retry (~18s) nhỏ hơn ngưỡng hết hạn lệnh 60s nên lệnh đang retry không bị từ chối vì `COMMAND_EXPIRED`; retry cùng `command_id` kết hợp deduplication (bên dưới) giữ cho lệnh idempotent.
- **Timeout phát hiện Offline:** Heartbeat được ESP32 gửi định kỳ mỗi 10 giây. Nếu sau 30 giây (3 chu kỳ heartbeat liên tiếp) Backend không nhận được bất kỳ bản tin heartbeat hoặc telemetry nào từ thiết bị, Backend tự động cập nhật `device_status = 'OFFLINE'` và sinh bản ghi cảnh báo `DEVICE_OFFLINE`.
  - *Lý do/Rationale:* Cần thiết để backend duy trì tiến trình kiểm tra liveness và phát hiện thiết bị mất nguồn.
- **Xử lý bản tin trùng (Deduplication) [ĐÃ BỔ SUNG]:** ESP32 và Backend duy trì danh sách FIFO/LRU cache lưu 50 `command_id` gần nhất trong vòng 60 giây, **kèm ACK đã tạo cho từng `command_id`**. Nếu nhận lại một `command_id` đã có trong cache (do QoS 1 giao lại hoặc do retry của Backend), hệ thống **không** thực thi lại và **không** kiểm tra hết hạn lại, mà phát lại đúng ACK cũ.
  - **Thứ tự xử lý lệnh trên ESP32:** dedup → kiểm tra hợp lệ → kiểm tra hết hạn → thực thi → cập nhật PWM → bật `manual_override` → gửi ACK (chi tiết: `ARCHITECTURE.md` mục 7.2).
  - *Lý do/Rationale:* QoS 1 đảm bảo "at-least-once" nên có thể gây trùng bản tin khi mạng chập chờn; dedup đứng đầu và phát lại ACK cũ để bản trùng đến muộn không bị từ chối nhầm là `COMMAND_EXPIRED`, đảm bảo tính idempotent của lệnh điều khiển.
- **Lưu ý chung:** các con số ở mục B.6 (5s, 1s/2s, 30s, 50 `command_id`/60s...) là **giá trị đề xuất ban đầu để bắt đầu code**, cần hiệu chỉnh sau khi đo thực tế, không phải số liệu đã kiểm chứng.

### B.7 Xác thực và phân quyền MQTT (device auth + ACL): [ĐÃ BỔ SUNG]

**Nguyên tắc (contract):**

```text
ESP32: device_id + device_key
        ↓
Broker authentication (xác thực dựa trên DB)
        ↓
So khớp với DEVICE.credential_hash (bcrypt)
        ↓
ACL theo device_id
        ↓
chỉ được truy cập iot/device/{own_device_id}/...
```

- **ACL thiết bị:** publish `telemetry`, `status`, `ack`; subscribe `command`, `config` — chỉ trên topic có `{device_id}` của chính mình. Publish/subscribe topic khác bị broker từ chối. Mỗi thiết bị có credential riêng, không dùng chung.
- **Tài khoản backend:** credential MQTT riêng của Backend (lưu qua biến môi trường), được subscribe `iot/device/+/telemetry|status|ack` và publish `iot/device/+/command|config`. Không dùng chung với thiết bị.
- **Quyền kết nối theo `lifecycle_status`:**

| lifecycle_status | MQTT connect / ACL |
|---|---|
| REGISTERED | Từ chối |
| PROVISIONED | **Cho phép** (để thiết bị kết nối lần đầu và chuyển sang ACTIVE) |
| ACTIVE | Cho phép |
| MAINTENANCE | Từ chối (tạm khóa) |
| DECOMMISSIONED | Từ chối vĩnh viễn |

- `credential_hash` **không bị xóa** khi thiết bị bị từ chối; broker từ chối dựa trên `lifecycle_status`. Lịch sử dữ liệu giữ nguyên.
- **TODO/UNDEFINED:** (1) plugin/cơ chế cụ thể cho Mosquitto, kèm kiểm chứng tương thích định dạng hash của `bcryptjs`; (2) cơ chế ngắt thiết bị **đang kết nối** khi chuyển sang `MAINTENANCE`/`DECOMMISSIONED` (cache ACL với TTL ngắn, hoặc backend chủ động ngắt client). Không tự chọn khi implement — chốt rồi cập nhật mục này.
- *Lý do/Rationale:* Mosquitto không tự so khớp bcrypt hash trong PostgreSQL nên cần cơ chế bổ sung. `PROVISIONED` phải được phép kết nối vì `PROVISIONED → ACTIVE` xảy ra khi thiết bị kết nối và gửi heartbeat đầu tiên. Đáp ứng yêu cầu thiết bị có định danh/khóa riêng và thiết bị bị thu hồi không gửi được dữ liệu.

---

## Phần C — Socket.IO Realtime Events [ĐÃ BỔ SUNG]

Frontend kết nối Socket.IO tới Backend để nhận cập nhật thời gian thực. Đây **không phải** kênh giao tiếp với ESP32 (ESP32 chỉ giao tiếp qua MQTT — xem Phần B).

### C.1 Danh sách event

| Event | Khi nào emit | Payload |
|---|---|---|
| `telemetry:update` | Mỗi khi backend lưu một bản ghi TELEMETRY mới | Giống response của `GET /devices/:id/telemetry/latest` |
| `device:status` | Khi `device_status` đổi (ONLINE/OFFLINE/FAULT) | `{ "device_id": "...", "device_status": "...", "last_seen_at": "..." }` |
| `command:update` | Khi `COMMAND.status` đổi (SENT/ACKNOWLEDGED/FAILED/TIMEOUT) | Giống response của `POST /devices/:id/commands`, cập nhật `status`/`result` |
| `alert:new` | Khi tạo alert mới | Giống 1 phần tử trong response của `GET /alerts` |

Payload của cả 4 event đều tái dùng đúng schema JSON đã định nghĩa ở Phần A — không tạo thêm cấu trúc dữ liệu riêng cho realtime.

### C.2 Scope

**[ĐÃ BỔ SUNG]** Mỗi thiết bị tương ứng một room `device:{device_id}`. Sau khi xác thực JWT, server cho socket vào room của các thiết bị user được phép truy cập (Admin: tất cả). Mọi event chỉ emit tới room của thiết bị liên quan. Khi `PUT /devices/:id/access` thay đổi quyền, server cập nhật room của user bị ảnh hưởng. Cách kiểm tra lại quyền khi access token hết hạn trong phiên socket: **TODO/UNDEFINED**.

### C.3 Authentication

Chỉ **client đã xác thực** (có JWT access token hợp lệ) mới được phép kết nối Socket.IO và nhận các event trên. Cơ chế xác thực cụ thể (middleware handshake, truyền token qua query/header...) là chi tiết implementation: **TODO/UNDEFINED**, cần chốt khi triển khai. Hành vi bắt buộc: client không có JWT hợp lệ phải bị từ chối kết nối.

### C.4 Độ tin cậy

Socket.IO **chỉ dùng để cập nhật realtime**; **REST/Database là source of truth**. Client không được giả định việc nhận event đồng nghĩa dữ liệu đã được lưu, hoặc giả định sẽ luôn nhận được mọi event đã phát (có thể bỏ lỡ nếu mất kết nối tạm thời). Khi client reload/reconnect, phải tự đồng bộ lại trạng thái bằng cách gọi lại REST endpoint tương ứng, sau đó mới tiếp tục nhận cập nhật qua Socket.IO.
