# UI — Smart Lighting System

> Tài liệu này mô tả cấu trúc, hành vi và quy tắc giao diện Web.
>
> **UI.md không phải source of truth cho requirements, API, database hoặc architecture.**
> - Requirements, Permission Matrix: `docs/PRD.md`
> - Architecture, lifecycle: `docs/ARCHITECTURE.md`
> - REST / MQTT / Socket.IO contract, format lỗi: `docs/API_SPEC.md`
> - Database: `docs/DATABASE.md`
> - Development rules: `docs/PROJECT-RULES.md`
>
> Quy ước: `[ĐÃ BỔ SUNG]` là quyết định thiết kế UI của nhóm (không mâu thuẫn contract). `TODO/UNDEFINED` là điểm chưa chốt, không tự suy diễn thành requirement.

---

## 1. Scope

- Stack: React, TypeScript, Vite, Tailwind CSS, Socket.IO client, Recharts.
- Frontend chỉ giao tiếp Backend qua REST và Socket.IO. Không truy cập trực tiếp PostgreSQL hoặc MQTT Broker.
- Phạm vi prototype: 1 ESP32 vật lý (`LIGHT-001`) và thiết bị mô phỏng (`LIGHT-002`, dùng để demo phân quyền). UI phải hoạt động đúng với nhiều thiết bị.
- Chỉ là Web UI (desktop trước, tablet/mobile browser dùng được). Không có mobile app riêng.

## 2. Nguyên tắc thiết kế

1. **Dashboard-first.** Dashboard là màn hình giám sát chính của cả ba vai trò.
2. **Role-aware và device-scope-aware.** UI thay đổi theo role và theo thiết bị được cấp (`DEVICE_ACCESS`). Ẩn nút chỉ là UX; Backend mới là security boundary.
3. **REST/Database là source of truth.** Socket.IO chỉ cập nhật realtime. Khi load/reload/reconnect: lấy lại dữ liệu qua REST rồi mới nhận realtime tiếp.
4. **Không hứa quá mức.** Chỉ hiển thị dữ liệu mà contract thực sự cung cấp (xem mục 12.3, 13.3).
5. **Không dùng màu làm tín hiệu duy nhất.** Trạng thái luôn kèm chữ hoặc icon.

---

## 3. Vai trò × màn hình

Ký hiệu: ✓ = được; **S** = chỉ trên thiết bị được cấp quyền; ✗ = không hiển thị (Backend trả `403`).

| Màn hình | Route | Admin | Operator | Viewer |
|---|---|---|---|---|
| Login | `/login` | Public | Public | Public |
| Đổi mật khẩu | `/account/password` | ✓ | ✓ | ✓ |
| Dashboard | `/` | ✓ (tất cả) | S | S |
| Danh sách thiết bị | `/devices` | ✓ (tất cả) | S | S |
| Chi tiết thiết bị: Overview | `/devices/:id` | ✓ | S | S |
| Chi tiết thiết bị: Control | `/devices/:id/control` | ✓ | S | ✗ |
| Chi tiết thiết bị: Telemetry History | `/devices/:id/telemetry` | ✓ | S | S |
| Chi tiết thiết bị: Adaptive Config | `/devices/:id/config` | ✓ | ✗ | ✗ |
| Chi tiết thiết bị: Access | `/devices/:id/access` | ✓ | ✗ | ✗ |
| Chi tiết thiết bị: Lifecycle | `/devices/:id/lifecycle` | ✓ | ✗ | ✗ |
| Onboarding thiết bị | `/devices/new` | ✓ | ✗ | ✗ |
| Alerts: xem | `/alerts` | ✓ | S | S |
| Alerts: acknowledge / resolve | `/alerts` | ✓ | S | ✗ |
| User Management | `/users` | ✓ | ✗ | ✗ |
| Audit Log | `/audit-logs` | ✓ | ✗ | ✗ |

Route theo role là `[ĐÃ BỔ SUNG]`, nhóm có thể đổi tên path nhưng không đổi quyền.

Điều hướng (sidebar) theo role:

| Role | Mục sidebar |
|---|---|
| Admin | Dashboard, Devices, Alerts, Users, Audit Log |
| Operator | Dashboard, Devices, Alerts |
| Viewer | Dashboard, Devices, Alerts |

Telemetry History, Control, Config, Access, Lifecycle là tab trong chi tiết thiết bị, không có mục riêng ở sidebar.

---

## 4. App shell và bố cục

### 4.1 Cấu trúc

```text
┌───────────┬──────────────────────────────────────────┐
│           │ Topbar (sáng)                            │
│ Sidebar   ├──────────────────────────────────────────┤
│ (tối)     │ Main content (nền sáng)                  │
│           │                                          │
└───────────┴──────────────────────────────────────────┘
```

- **Sidebar tối** `[ĐÃ BỔ SUNG]`: nền tối, logo/tên hệ thống ở trên, menu theo role, mục đang chọn có nền nổi bật và thanh nhấn. Rộng 240px trên desktop; thu gọn thành icon-only 72px ở tablet; dạng drawer trên mobile.
- **Topbar sáng** `[ĐÃ BỔ SUNG]`: nền trắng, viền dưới mảnh. Hiển thị tên trang, chỉ báo kết nối realtime, tên người dùng, badge role, menu (Đổi mật khẩu, Logout).
- **Main content sáng** `[ĐÃ BỔ SUNG]`: nền xám rất nhạt, nội dung đặt trong card trắng. Đây là yêu cầu bắt buộc: khu vực làm việc chính luôn sáng, chỉ sidebar tối.
- Không có dark mode toàn app trong Phase 1.

### 4.2 Chỉ báo realtime (Topbar)

Ba trạng thái, có chữ kèm chấm:

| Trạng thái | Ý nghĩa |
|---|---|
| Realtime: đang kết nối | Socket.IO connected |
| Realtime: đang kết nối lại… | Mất kết nối, đang reconnect |
| Realtime: ngắt | Không kết nối được; dữ liệu có thể cũ, hiện nút "Tải lại" |

---

## 5. Design tokens [ĐÃ BỔ SUNG]

Dùng Tailwind. Tên token là gợi ý, khai báo trong `tailwind.config` hoặc CSS variables để đổi một chỗ.

### 5.1 Màu nền và chữ

| Token | Giá trị | Dùng cho |
|---|---|---|
| `bg-sidebar` | `#0F172A` | Nền sidebar |
| `text-sidebar` | `#CBD5E1` | Chữ menu thường |
| `text-sidebar-active` | `#FFFFFF` | Chữ menu đang chọn |
| `bg-sidebar-active` | `#1E293B` | Nền mục đang chọn |
| `bg-app` | `#F8FAFC` | Nền main content |
| `bg-surface` | `#FFFFFF` | Card, bảng, topbar |
| `border-default` | `#E2E8F0` | Viền card, đường kẻ bảng |
| `text-primary` | `#0F172A` | Chữ chính |
| `text-secondary` | `#475569` | Chữ phụ, nhãn |
| `text-muted` | `#94A3B8` | Placeholder, timestamp phụ |
| `accent` | `#2563EB` | Nút chính, link, mục focus |
| `accent-light` | `#F59E0B` | Chỉ dùng cho yếu tố "ánh sáng/PWM" (thanh PWM, icon bóng đèn) |

Contrast: chữ chính trên `bg-surface`/`bg-app` và chữ sidebar trên `bg-sidebar` phải đạt tối thiểu WCAG AA (4.5:1).

### 5.2 Màu trạng thái (mục 19.1 bản cũ)

Mỗi trạng thái là badge gồm **chấm màu + nhãn chữ**, nền nhạt, chữ đậm.

| Loại | Giá trị | Nền / chữ | Nhãn |
|---|---|---|---|
| `device_status` | `ONLINE` | xanh lá | Online |
| | `OFFLINE` | xám | Offline |
| | `FAULT` | đỏ | Lỗi |
| `lifecycle_status` | `REGISTERED` | xám | Đã đăng ký |
| | `PROVISIONED` | xanh dương | Đã cấp khóa |
| | `ACTIVE` | xanh lá | Hoạt động |
| | `MAINTENANCE` | vàng cam | Bảo trì |
| | `DECOMMISSIONED` | xám đậm, gạch ngang tên | Đã thu hồi |
| Alert `status` | `NEW` | đỏ | Mới |
| | `ACKNOWLEDGED` | vàng cam | Đã xác nhận |
| | `RESOLVED` | xanh lá | Đã xử lý |
| Alert `severity` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` | xám / vàng / cam / đỏ | Thấp / Trung bình / Cao / Nghiêm trọng |
| Command `status` | `PENDING` / `SENT` | xám / xanh dương | Đang chờ / Đã gửi |
| | `ACKNOWLEDGED` | xanh lá | Thiết bị đã thực thi |
| | `FAILED` / `TIMEOUT` | đỏ | Thất bại / Hết thời gian chờ |

`device_status` và `lifecycle_status` là hai trường độc lập, luôn hiển thị thành hai badge riêng, không gộp.

### 5.3 Typography

- Font: `Inter` (fallback `system-ui, sans-serif`). Số liệu telemetry dùng `font-variant-numeric: tabular-nums`.
- Cỡ: tiêu đề trang 24px/semibold; tiêu đề card 16px/semibold; nội dung 14px; chú thích 12px.

### 5.4 Khác

- Bo góc card 12px, nút/input 8px. Bóng đổ nhẹ cho card (`shadow-sm`). Khoảng cách theo thang 4px.
- Component dự kiến: Button, Input, Select, Slider, Switch, Card, Badge, Table, Modal, Toast, Tabs, Chart, StatusIndicator, EmptyState, ErrorState, Skeleton.

---

## 6. Xử lý lỗi theo format chuẩn

Backend trả lỗi dạng `{ code, message, details }` (`API_SPEC.md`, mục Quy ước chung). **UI dựa vào `code`, không dựa vào `message`.** `message` chỉ dùng làm chữ hiển thị mặc định.

| HTTP / `code` | Hành vi UI |
|---|---|
| `401 UNAUTHORIZED` | Gọi `POST /auth/refresh` một lần. Thành công thì gửi lại request; thất bại thì xóa auth state, về `/login` kèm thông báo "Phiên đăng nhập đã hết hạn". |
| `401 INVALID_CREDENTIALS` | Hiển thị trong form Login, không xóa username. |
| `403 ACCOUNT_LOCKED` | Hiển thị trong form Login: tài khoản bị khóa, liên hệ Admin. |
| `403 FORBIDDEN` | Trang/nút "Bạn không có quyền thực hiện thao tác này". Không đẩy về Login. |
| `404 *_NOT_FOUND` / `NOT_FOUND` | Trang "Không tìm thấy". **Không phân biệt** "không tồn tại" và "không được cấp quyền" (Backend cố ý gộp chung). |
| `400 VALIDATION_ERROR` | Map `details` vào từng field của form; không có `details` thì hiện lỗi chung ở đầu form. |
| `400 INVALID_LIFECYCLE_TRANSITION` | Toast lỗi, refetch thiết bị để đồng bộ trạng thái. |
| `409 DEVICE_NOT_AVAILABLE` | Trên tab Control: thông báo thiết bị đang offline hoặc không ở trạng thái Hoạt động; refetch thiết bị. |
| `409 USERNAME_EXISTS`, `DEVICE_EXISTS`, `CONFLICT` | Lỗi tại field tương ứng hoặc toast. |
| `500 INTERNAL_ERROR` | ErrorState chung kèm nút "Thử lại". Không hiển thị chi tiết kỹ thuật. |
| Lỗi mạng (không có response) | ErrorState "Không kết nối được máy chủ" kèm "Thử lại". |

---

## 7. Authentication UI

### 7.1 Login (`POST /auth/login`)

- Trường: username, password. Nút "Đăng nhập" disable khi đang gửi.
- Thành công: lưu `access_token` **trong memory** (React context/state), **không** lưu localStorage/sessionStorage. Refresh token nằm trong HttpOnly Cookie do trình duyệt tự gửi.
- Chuyển tới `/` (hoặc trang đang định vào trước khi bị đẩy về Login).
- Lỗi: theo mục 6.

### 7.2 Khôi phục phiên khi reload

Access token chỉ nằm trong memory nên mất khi reload. Khi app khởi động: gọi `POST /auth/refresh`. Thành công thì vào app; `401` thì về `/login`. Trong lúc chờ, hiển thị màn hình loading toàn trang, không flash trang Login.

### 7.3 Logout (`POST /auth/logout`)

Xóa auth state, ngắt Socket.IO, về `/login`. Nếu gọi API lỗi vẫn xóa state phía client.

### 7.4 Đổi mật khẩu (`PUT /auth/password`)

- Trường: mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu mới.
- Validate phía client trước khi gửi: mật khẩu mới tối thiểu 8 ký tự, gồm chữ và số, khác mật khẩu hiện tại; ô xác nhận phải khớp (ô xác nhận chỉ kiểm tra ở client, không gửi lên API).
- `401`: "Mật khẩu hiện tại không đúng". `400`: hiển thị theo `details`.
- Thành công: toast, giữ phiên đăng nhập (contract không yêu cầu đăng xuất lại).

---

## 8. Dashboard

Dành cho cả ba vai trò. Admin thấy toàn bộ thiết bị; Operator/Viewer chỉ thấy thiết bị được cấp. Nền sáng, bố cục card trắng.

### 8.1 Bố cục

```text
┌──────────┬──────────┬──────────┬──────────┐
│ Thiết bị │ Online   │ Cảnh báo │ Công suất│  ← Hàng KPI
│ tổng     │/Off/Lỗi  │ đang mở  │ TB (W)   │
├──────────┴──────────┴──────────┴──────────┤
│ Danh sách thiết bị (thẻ rút gọn)          │
├─────────────────────┬─────────────────────┤
│ Biểu đồ lux & PWM   │ Biểu đồ dòng/công   │
│ (thiết bị đang chọn)│ suất                │
├─────────────────────┴─────────────────────┤
│ Cảnh báo mới/gần đây                      │
└───────────────────────────────────────────┘
```

### 8.2 Hàng KPI — `GET /dashboard/summary`

| Thẻ | Field |
|---|---|
| Tổng thiết bị | `devices.total` |
| Online / Offline / Lỗi | `devices.online`, `devices.offline`, `devices.fault` |
| Cảnh báo đang mở | `alerts.active_count` (kèm `alerts.resolved_today` ở dòng phụ) |
| Công suất trung bình | `avg_power_watts` (W) |

`system_status` hiển thị như badge nhỏ ở góc trang. `updated_at` hiển thị dạng "Cập nhật lúc …". Giá trị liệt kê cụ thể của `system_status` ngoài ví dụ `HEALTHY` chưa được xác định: `TODO/UNDEFINED` (UI hiển thị nguyên giá trị nhận được, không tự đặt thêm mapping).

### 8.3 Danh sách thiết bị — `GET /dashboard/devices`

Mỗi thẻ: tên + `device_id`, badge `device_status`, lux, motion, PWM (thanh tiến trình màu `accent-light`), công suất, `last_seen_at` (dạng tương đối: "5 giây trước"). Bấm thẻ vào chi tiết thiết bị.

Endpoint này không trả `lifecycle_status`; muốn xem thì vào danh sách/chi tiết.

### 8.4 Biểu đồ (Recharts)

- Dữ liệu: `GET /devices/:id/telemetry?from&to&limit` cho thiết bị đang chọn (mặc định thiết bị đầu tiên trong danh sách).
- Biểu đồ 1: lux (đường) và PWM % (đường thứ hai, trục phải). Biểu đồ 2: dòng điện và công suất.
- Mặc định `[ĐÃ BỔ SUNG]`: 1 giờ gần nhất, tối đa 200 điểm. Có bộ chọn 15 phút / 1 giờ / 6 giờ / 24 giờ (giới hạn `limit` ≤ 1000 theo API).
- Khi có `telemetry:update` cho thiết bị đang chọn: thêm điểm mới vào cuối, bỏ điểm cũ nhất khi vượt giới hạn.

### 8.5 Cảnh báo gần đây

Lấy từ `GET /alerts?status=NEW&limit=5`. Mỗi dòng: loại, mức độ, thiết bị, thời gian. Link "Xem tất cả" tới `/alerts`. Cập nhật qua `alert:new`.

### 8.6 Trạng thái đặc biệt

- Operator/Viewer chưa được cấp thiết bị nào: EmptyState "Bạn chưa được cấp quyền truy cập thiết bị nào. Liên hệ Admin." (các thẻ KPI hiện 0).
- Thiết bị chưa có telemetry: biểu đồ hiện "Chưa có dữ liệu".

---

## 9. Device Management

### 9.1 Danh sách thiết bị — `GET /devices`

- Cột: `device_id`, tên, vị trí, badge `device_status`, badge `lifecycle_status`, `last_seen_at`.
- Bộ lọc theo contract: `status` (ONLINE/OFFLINE/FAULT), `lifecycle` (5 giá trị), phân trang `limit`/`offset` (mặc định 20).
- Admin có nút "Thêm thiết bị" (onboarding). Operator/Viewer không có.
- Thiết bị `DECOMMISSIONED` vẫn hiển thị (giữ lịch sử), tên làm mờ, không có thao tác.

### 9.2 Chi tiết thiết bị — `GET /devices/:id`

Trang có header (tên, `device_id`, hai badge trạng thái, vị trí, firmware, `last_seen_at`) và các **tab** `[ĐÃ BỔ SUNG]`:

| Tab | Role thấy | Nội dung |
|---|---|---|
| Overview | Tất cả | Latest telemetry (`GET /devices/:id/telemetry/latest`), biểu đồ ngắn, thông tin thiết bị, người phụ trách (`assigned_user_id`, chỉ là thông tin hiển thị) |
| Control | Admin, Operator | Mục 10 |
| Telemetry | Tất cả | Mục 12 |
| Adaptive Config | Admin | Mục 11 |
| Access | Admin | Mục 9.5 |
| Lifecycle | Admin | Mục 9.4 |

Admin có thêm nút "Chỉnh sửa" (tên, vị trí, người phụ trách) qua `PUT /devices/:id`.

### 9.3 Onboarding — `POST /devices` (Admin)

- Form: `device_id` (bắt buộc), `device_name` (bắt buộc), `location`, `assigned_user_id` (chọn từ danh sách user).
- Thành công: mở modal hiển thị `device_key`.
  - Nhãn rõ: "Khóa này chỉ hiển thị **một lần**. Lưu lại để nạp vào firmware."
  - Có nút Copy. Không có nút xem lại ở bất kỳ nơi nào khác.
  - Không lưu `device_key` vào localStorage/sessionStorage/state lâu dài/log; xóa khỏi state khi đóng modal.
  - Khi đóng modal, hỏi xác nhận "Bạn đã lưu khóa chưa?".
- Thiết bị mới có `lifecycle_status = REGISTERED`. `409 DEVICE_EXISTS`: báo lỗi tại field `device_id`.

### 9.4 Lifecycle — `PATCH /devices/:id/lifecycle` (Admin)

UI chỉ hiển thị các nút **hợp lệ** theo state machine (`ARCHITECTURE.md` mục 8), không tự thêm transition:

| Trạng thái hiện tại | Nút hiển thị |
|---|---|
| `REGISTERED` | "Chuyển sang Đã cấp khóa" (`PROVISIONED`). Có ghi chú: chỉ thực hiện sau khi đã nạp `device_key` vào firmware. |
| `PROVISIONED` | Không có nút kích hoạt. Hiển thị: "Đang chờ thiết bị kết nối lần đầu; hệ thống tự chuyển sang Hoạt động." Không có nút Thu hồi ở trạng thái này vì contract chỉ cho `ACTIVE`/`MAINTENANCE` → `DECOMMISSIONED`. |
| `ACTIVE` | "Chuyển sang Bảo trì", "Thu hồi thiết bị" |
| `MAINTENANCE` | "Kích hoạt lại" (→ `ACTIVE`), "Thu hồi thiết bị" |
| `DECOMMISSIONED` | Không có nút. Ghi: "Đã thu hồi vĩnh viễn, không thể đảo ngược." |

- Chuyển sang `MAINTENANCE`: confirm, giải thích thiết bị sẽ bị ngắt MQTT, không nhận lệnh, không sinh cảnh báo offline.
- Chuyển sang `DECOMMISSIONED`: modal confirm mức cao (phải gõ lại `device_id` để xác nhận) vì không đảo ngược.
- Nếu Backend trả `400 INVALID_LIFECYCLE_TRANSITION`: refetch và hiển thị trạng thái thực.

### 9.5 Quản lý quyền truy cập — `GET/PUT /devices/:id/access` (Admin)

- Hiển thị danh sách user đang được cấp (username, role).
- Bộ chọn nhiều user: chỉ liệt kê user có role Operator/Viewer (lấy từ `GET /users`, lọc `role_name`). **Không liệt kê Admin** (API trả `400` nếu có Admin).
- "Lưu" gửi toàn bộ danh sách mới (`PUT` thay thế toàn bộ). Trước khi lưu, hiển thị tóm tắt: "Thêm: …, Gỡ: …".
- Lưu ý hiển thị: user bị gỡ quyền sẽ không thấy thiết bị này nữa.

---

## 10. Device Control (Admin, Operator)

API: `POST /devices/:id/commands` với `command_type` ∈ `PWM`, `ON`, `OFF`.

### 10.1 Điều kiện hiển thị/cho phép

Control chỉ dùng được khi `lifecycle_status = ACTIVE` **và** `device_status ≠ OFFLINE`. Ngược lại: disable toàn bộ control và hiển thị lý do cụ thể (ví dụ "Thiết bị đang offline", "Thiết bị đang bảo trì"). Backend vẫn là nơi quyết định (`409 DEVICE_NOT_AVAILABLE`).

### 10.2 Thành phần

- **PWM:** slider 0–100% đi kèm ô nhập số nguyên (hai chiều đồng bộ). Gửi khi bấm "Áp dụng" (không gửi liên tục khi kéo). Giá trị phải là số nguyên 0–100.
- **ON / OFF:** hai nút riêng. `ON` không có `command_value`.
- Ghi chú ngữ nghĩa `ON` (từ `API_SPEC.md` B.4): bật lại mức sáng thủ công gần nhất, nếu chưa có thì 100%. UI không cần tự tính mức này.

### 10.3 Phản hồi trạng thái lệnh

1. Gửi → nhận `202` với `command_id`, trạng thái `PENDING`.
2. Hiển thị "Lệnh gần nhất" kèm badge trạng thái, cập nhật theo `command:update`: `PENDING` → `SENT` → `ACKNOWLEDGED` / `FAILED` / `TIMEOUT`.
3. Nếu `FAILED`, hiển thị `result` (ví dụ `COMMAND_EXPIRED`) bằng chữ dễ hiểu. `TIMEOUT`: "Thiết bị không phản hồi".
4. Thời gian chờ tối đa khoảng 18 giây; trong lúc chờ, disable nút gửi của chính lệnh đó (không chặn các control khác).

Giới hạn cần biết: **chưa có REST endpoint tra cứu lệnh/lịch sử lệnh** (`API_SPEC.md` A.5). Hệ quả: reload trang thì mất "lệnh gần nhất"; UI không có trang Command History. Không tự thêm.

---

## 11. Adaptive Lighting Configuration (Admin)

API: `PATCH /devices/:id/config`. Dữ liệu `adaptive_config` lấy từ `GET /devices/:id`.

### 11.1 Form

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `enabled` | Switch | |
| `motion_timeout_sec` | Số nguyên | > 0 |
| `lux_thresholds` | Bảng các dòng `{ min_lux, pwm }` | `pwm` 0–100; giữ đúng cấu trúc contract |
| `no_motion_pwm` | Số nguyên | 0–100 |

- Hiển thị bảng ngưỡng theo thứ tự `min_lux` giảm dần, mỗi dòng kèm thanh PWM trực quan. Giá trị mặc định của dự án (400→30, 200→50, 100→70, 0→100, no-motion 10) là gợi ý hiển thị "Khôi phục mặc định", **không** hard-code lại trong logic khác.
- Không cho tự thêm trường ngoài contract.
- Ràng buộc bổ sung ngoài `API_SPEC.md` (ví dụ số dòng ngưỡng tối đa, thứ tự `min_lux` bắt buộc giảm dần, trùng `min_lux`): `TODO/UNDEFINED`. UI chỉ cảnh báo nhẹ ở client; quyết định cuối là Backend (`400 VALIDATION_ERROR`).
- Nút "Lưu" mở confirm tóm tắt thay đổi. Thành công: toast, cập nhật form theo response.

---

## 12. Telemetry History

Tab Telemetry của thiết bị. Dành cho cả ba vai trò (trên thiết bị được cấp).

### 12.1 Bộ lọc

Theo API: `from`, `to` (ISO datetime), `limit` (mặc định 100, tối đa 1000). Lối tắt `[ĐÃ BỔ SUNG]`: 15 phút, 1 giờ, 24 giờ, 7 ngày, tùy chọn.

### 12.2 Hiển thị

- Biểu đồ đường (lux, PWM, dòng, công suất) và bảng dữ liệu (timestamp, lux, motion, voltage, current, power, pwm) — chuyển bằng toggle.
- API **không có `offset`/phân trang**: UI không làm phân trang server-side; bảng cắt tại `limit`, có ghi chú nếu đã chạm `limit` ("Chỉ hiển thị N bản ghi mới nhất trong khoảng thời gian này").
- `400` (sai định dạng thời gian): thông báo tại bộ chọn ngày.
- Chính sách lưu trữ telemetry (retention) chưa xác định: `TODO/UNDEFINED`.

### 12.3 Trạng thái override

`manual_override` và `last_manual_pwm` là biến RAM trên ESP32, **không có trong telemetry hoặc REST**. UI **không** hiển thị nhãn "Adaptive / Manual Override" vì không có nguồn dữ liệu đáng tin. UI chỉ có thể hiển thị "Lệnh thủ công gần nhất trong phiên" (từ `command:update`, mất khi reload) kèm ghi chú rằng đèn có thể đang ở chế độ ghi đè đến khi trạng thái có người đổi. Muốn hiển thị chính thức cần mở rộng contract: `TODO/UNDEFINED`.

---

## 13. Alerts

API: `GET /alerts`, `PATCH /alerts/:id/acknowledge`, `PATCH /alerts/:id/resolve`.

### 13.1 Danh sách

- Cột: loại (`LAMP_FAULT`, `DEVICE_OFFLINE`), mức độ, nội dung, thiết bị, trạng thái, `created_at`.
- Bộ lọc theo contract: `status`, `device_id`, `severity`; `limit` (mặc định 50), `offset`.
- Mặc định sắp theo mới nhất. Tab nhanh: Tất cả / Mới / Đã xác nhận / Đã xử lý.
- Lọc theo thiết bị không được cấp trả danh sách rỗng (không phải lỗi).

### 13.2 Thao tác (Admin, Operator)

- `NEW` → nút "Xác nhận". `NEW`/`ACKNOWLEDGED` → nút "Giải quyết".
- "Giải quyết" mở modal có ô ghi chú tùy chọn (`note`) rồi gửi.
- Viewer: **không render** các nút này.
- Thao tác lỗi `404`: alert/thiết bị không còn truy cập được, refetch danh sách.
- Điều kiện chuyển trạng thái hợp lệ giữa `NEW`/`ACKNOWLEDGED`/`RESOLVED` ngoài mô tả trên (ví dụ giải quyết thẳng từ `NEW`, thao tác lặp): `TODO/UNDEFINED`, UI dựa vào phản hồi Backend.

### 13.3 Realtime

`alert:new`: chèn dòng mới vào đầu danh sách (nếu khớp bộ lọc hiện tại), tăng chỉ số "Cảnh báo đang mở" ở sidebar/KPI, hiện toast. Toast chi tiết (thời gian tự đóng, gộp nhiều alert): `TODO/UNDEFINED`; đề xuất tự đóng sau 6 giây và gộp khi có nhiều alert liên tiếp.

---

## 14. User Management (Admin)

API: `GET /users` (limit, offset), `POST /users`, `PUT /users/:id`, `PATCH /users/:id/status`.

- Bảng: username, email, role, badge `ACTIVE`/`LOCKED`, ngày tạo.
- Tạo user: username, email, mật khẩu ban đầu, role (chọn từ 3 role cố định, UI không tạo role mới). `409` (`USERNAME_EXISTS`...) báo tại field.
- Sửa user: email, role. Khi đổi role từ Admin xuống Operator/Viewer, hiển thị ghi chú: "User sẽ không thấy thiết bị nào cho đến khi được cấp quyền".
- Khóa/mở: confirm khi khóa. Không cho Admin tự khóa chính mình `[ĐÃ BỔ SUNG, ràng buộc phía UI]`.
- Việc gán thiết bị cho Operator/Viewer thực hiện ở tab Access của thiết bị (mục 9.5).

---

## 15. Audit Log (Admin)

API: `GET /audit-logs` (`user_id`, `action`, `limit` mặc định 50, `offset`).

- Bảng: thời gian, người thực hiện, hành động, thiết bị, mô tả, IP.
- Bộ lọc `action` dùng đúng danh sách trong `DATABASE.md` mục 10 (Auth, User, Device, Command, Alert). Hiển thị nhãn tiếng Việt cho từng mã nhưng gửi API bằng mã gốc.
- Chỉ đọc, không có thao tác sửa/xóa. Không có trang Command History riêng.

---

## 16. Realtime (Socket.IO)

| Event | Hành vi UI |
|---|---|
| `telemetry:update` | Cập nhật số liệu, biểu đồ, thẻ thiết bị đang hiển thị |
| `device:status` | Cập nhật badge `device_status` và `last_seen_at`; nếu đang ở tab Control và thiết bị chuyển `OFFLINE`, disable control |
| `command:update` | Cập nhật "lệnh gần nhất" (mục 10.3) |
| `alert:new` | Mục 13.3 |

Payload tái dùng schema ở `API_SPEC.md` (Phần C.1); UI không tự tạo schema khác.

### 16.1 Xác thực và phạm vi

- Chỉ kết nối Socket.IO khi đã có access token hợp lệ; không có JWT hợp lệ thì bị từ chối kết nối. Cơ chế truyền JWT trong handshake: `TODO/UNDEFINED` (chốt khi làm Giai đoạn 5).
- Server đưa socket vào room `device:{device_id}` của các thiết bị user được phép; client không tự chọn room. Client chỉ nhận event của thiết bị được cấp.
- Cách xử lý khi access token hết hạn giữa phiên socket: `TODO/UNDEFINED`.

### 16.2 Reconnect

Khi reconnect: coi event bị bỏ lỡ là chưa đồng bộ. Refetch qua REST (dashboard, thiết bị đang xem, alerts) rồi tiếp tục nhận realtime.

### 16.3 Khi quyền thay đổi

Contract chỉ nói server cập nhật room khi `PUT /devices/:id/access`; không có event thông báo riêng. Do đó UI refetch danh sách thiết bị khi: mở lại tab trình duyệt, reconnect, hoặc gặp `404` khi thao tác. Không giả định Operator/Viewer được báo ngay.

---

## 17. Loading / Empty / Error

Mọi màn lấy dữ liệu qua REST có đủ bốn trạng thái:

| Trạng thái | Cách hiển thị |
|---|---|
| Loading | Skeleton theo hình dạng nội dung (card, bảng), không spinner toàn trang trừ lúc khởi động app |
| Empty | EmptyState có icon, một câu giải thích, hành động gợi ý nếu role cho phép |
| Error | ErrorState theo mục 6, có nút "Thử lại" |
| Success | Nội dung |

Câu chữ empty đề xuất:

| Màn hình | Nội dung |
|---|---|
| Danh sách thiết bị (Admin) | "Chưa có thiết bị nào. Bấm Thêm thiết bị để bắt đầu." |
| Danh sách thiết bị (Operator/Viewer) | "Bạn chưa được cấp quyền truy cập thiết bị nào." |
| Alerts | "Không có cảnh báo nào." |
| Telemetry | "Chưa có dữ liệu trong khoảng thời gian này." |

---

## 18. Xác nhận thao tác quan trọng

| Thao tác | Mức xác nhận |
|---|---|
| Thu hồi thiết bị (`DECOMMISSIONED`) | Modal, gõ lại `device_id` |
| Chuyển `MAINTENANCE` | Modal confirm kèm giải thích hệ quả |
| Khóa user | Modal confirm |
| Lưu danh sách quyền truy cập | Hiển thị tóm tắt thay đổi, confirm |
| Lưu Adaptive Config | Confirm tóm tắt thay đổi |
| Giải quyết alert | Modal (có ô ghi chú), không cần gõ xác nhận |
| Đóng modal `device_key` | Hỏi "Bạn đã lưu khóa chưa?" |
| Mở khóa user, xác nhận alert, gửi lệnh điều khiển | Không cần confirm |

---

## 19. Responsive

| Breakpoint | Hành vi |
|---|---|
| ≥ 1024px (desktop) | Sidebar đầy đủ 240px, lưới KPI 4 cột |
| 768–1023px (tablet) | Sidebar thu gọn icon-only, KPI 2 cột |
| < 768px (mobile browser) | Sidebar thành drawer mở bằng nút menu, KPI 1–2 cột, bảng cuộn ngang trong container riêng; slider PWM cỡ lớn dễ chạm |

Breakpoint dùng chuẩn Tailwind (`md` = 768, `lg` = 1024) `[ĐÃ BỔ SUNG]`.

---

## 20. Accessibility

Mức tối thiểu `[ĐÃ BỔ SUNG]`:

- Mọi nút chỉ có icon phải có `aria-label`.
- Trạng thái luôn có chữ (mục 5.2); không dùng màu đơn độc.
- Điều hướng bằng bàn phím được cho sidebar, tab, modal (focus trap, `Esc` để đóng), bảng và form; focus ring nhìn thấy rõ.
- Form: mỗi input có `label`, lỗi gắn với input bằng `aria-describedby`.
- Toast realtime dùng `aria-live="polite"`.
- Contrast theo mục 5.1.

Mục tiêu chuẩn đầy đủ (ví dụ WCAG AA toàn bộ): `TODO/UNDEFINED`.

---

## 21. Tài liệu hình ảnh

- Hiện chưa có mockup chính thức. Không dùng ảnh bên ngoài làm requirement khi chưa xác nhận.
- Mockup chính thức đặt tại `docs/ui/design/` và ghi rõ trong UI.md là `Design Reference`.
- Screenshot sản phẩm thật đặt tại `docs/ui/evidence/` và ghi rõ là `Implementation Evidence`.
- Hình ảnh không phải source of truth cho API, database, phân quyền.

---

## 22. Điểm còn mở

| Nội dung | Trạng thái |
|---|---|
| Cơ chế truyền JWT trong Socket.IO handshake | TODO/UNDEFINED |
| Xử lý access token hết hạn giữa phiên Socket.IO | TODO/UNDEFINED |
| Các giá trị `system_status` ngoài `HEALTHY` | TODO/UNDEFINED |
| Ràng buộc chi tiết của `lux_thresholds` | TODO/UNDEFINED |
| Hiển thị trạng thái `manual_override` | TODO/UNDEFINED (cần mở rộng contract) |
| Command history | TODO (chưa có REST endpoint) |
| Retention telemetry | TODO/UNDEFINED |
| Toast cảnh báo (thời gian, gộp) | TODO/UNDEFINED (đã có đề xuất) |
| Chuẩn accessibility đầy đủ | TODO/UNDEFINED |
| Mockup chính thức | Chưa có |

---

## 23. Quy tắc triển khai UI

- Không tự thêm chức năng ngoài `PRD.md`; không tự đổi RBAC hoặc device scope.
- Không tự tạo endpoint chỉ để phục vụ UI. Nếu UI cần dữ liệu mà contract chưa có, đánh dấu `TODO` và hỏi nhóm.
- Không truy cập PostgreSQL hoặc MQTT trực tiếp từ Frontend.
- Access token trong memory; không lưu token, `device_key` hay dữ liệu nhạy cảm vào localStorage/sessionStorage.
- Dựa vào `code` lỗi, không dựa vào `message`.
- Backend authorization là security boundary; ẩn nút chỉ là UX.
- Khi UI thay đổi API, database hoặc architecture, cập nhật tài liệu tương ứng theo `PROJECT-RULES.md` mục 11, cùng một commit.
- Mỗi hàng ✗ và **S** trong mục 3 cần ít nhất một test RBAC/UI tương ứng khi làm Giai đoạn 6 (đăng nhập cả 3 role, đối chiếu menu/nút hiển thị).
