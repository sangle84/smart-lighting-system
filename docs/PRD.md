# PRD — Smart Lighting System

> Tài liệu này mô tả **WHAT và WHY** của hệ thống. Không chứa implementation detail (xem `ARCHITECTURE.md`, `API_SPEC.md`, `DATABASE.md` cho phần đó).

## 1. Product Overview

- **Tên hệ thống:** Smart Lighting System — Hệ thống chiếu sáng thông minh giám sát và điều khiển qua MQTT.
- **Bối cảnh:** Trong không gian sinh hoạt/làm việc, nhu cầu chiếu sáng thay đổi theo điều kiện ánh sáng tự nhiên và trạng thái sử dụng của phòng. Điều chỉnh đèn hoàn toàn thủ công gây bất tiện và tăng tiêu thụ điện.
- **Vấn đề cần giải quyết:**
  - Hệ thống cần tự động nhận biết điều kiện môi trường (ánh sáng, chuyển động) để điều chỉnh đèn phù hợp.
  - Hệ thống cần nhận biết tình trạng hoạt động bất thường của đèn (ví dụ: đèn được bật nhưng dòng điện đo được thấp bất thường) để người vận hành kiểm tra kịp thời.
- **Mục tiêu:** Xây dựng một hệ thống IoT hoàn chỉnh (thiết bị vật lý → truyền dữ liệu qua mạng → nhận lệnh điều khiển từ xa → duy trì trạng thái hoạt động), điều mà một giao diện Web đơn thuần không thể thay thế.

## 2. Goals

Hệ thống cung cấp các nhóm mục tiêu chính sau:

- **Giám sát cảm biến:** thu thập cường độ ánh sáng (Lux), chuyển động, và thông số điện năng (điện áp, dòng điện, công suất) của đèn.
- **Điều khiển đèn:** bật/tắt và điều chỉnh độ sáng LED từ giao diện Web.
- **Adaptive Lighting:** tự động điều chỉnh độ sáng dựa trên Lux và chuyển động.
- **Cảnh báo:** phát hiện và lưu cảnh báo khi đèn hoạt động bất thường (lỗi đèn) hoặc khi thiết bị mất kết nối (offline).
- **Quản lý thiết bị:** quản lý vòng đời thiết bị từ onboarding đến decommission.
- **Quản lý user:** quản lý người dùng và vai trò.
- **RBAC:** phân quyền theo vai trò (Admin, Operator, Viewer).
- **Authentication:** xác thực người dùng trước khi truy cập hệ thống.

## 3. Scope

Phạm vi triển khai hiện tại của hệ thống (theo mục 1.2.3 báo cáo gốc):

- 01 node ESP32 **vật lý** (`LIGHT-001`) cho prototype, cộng thiết bị **mô phỏng** (`LIGHT-002`, trình giả lập MQTT) chỉ dùng để kiểm thử phân quyền, thu hồi và mở rộng; thiết bị mô phỏng không thay thế thiết bị vật lý.
- LED strip 2835 DC 12V làm cơ cấu chấp hành.
- BH1750, RCWL-0516 và INA219 làm cảm biến.
- MQTT/Mosquitto làm giao thức IoT.
- Backend Node.js + Express + TypeScript.
- PostgreSQL làm hệ quản trị cơ sở dữ liệu.
- Frontend React + TypeScript + Vite + Tailwind CSS.
- Docker Compose cho môi trường triển khai.

Hệ thống cung cấp bốn nhóm chức năng chính: giám sát môi trường và điện năng; điều khiển đèn từ giao diện Web; Adaptive Lighting dựa trên Lux và chuyển động; cảnh báo khi đèn bật nhưng dòng điện tiêu thụ thấp bất thường hoặc khi thiết bị mất kết nối.

## 4. Out of Scope

Phạm vi hiện tại **không bao gồm** (giữ nguyên theo báo cáo gốc — không tự thêm/bớt):

- AI/ML
- OTA (Over-The-Air firmware update)
- RGB (điều khiển màu đèn)
- Báo cháy
- Báo trộm
- Camera
- Mobile app riêng

## 5. Users and Roles

| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| **Admin** | Quản trị hệ thống | User, Device, cấu hình, điều khiển, cảnh báo, cấp quyền truy cập thiết bị — trên mọi thiết bị |
| **Operator** | Người vận hành | Xem, điều khiển đèn, xử lý cảnh báo — **trên thiết bị được cấp quyền** |
| **Viewer** | Người giám sát | Chỉ xem dashboard, lịch sử và trạng thái — **trên thiết bị được cấp quyền** |

## 6. Functional Requirements

| ID | Requirement |
|---|---|
| FR-001 | Hệ thống phải cho phép người dùng đăng nhập/đăng xuất (Admin, Operator, Viewer). |
| FR-002 | Hệ thống phải cho phép người dùng đổi mật khẩu. |
| FR-003 | Hệ thống phải cho phép Admin quản lý User (tạo, cập nhật, khóa/mở). |
| FR-004 | Hệ thống phải cho phép Admin onboarding thiết bị mới. |
| FR-005 | Hệ thống phải cho phép Admin quản lý vòng đời thiết bị (lifecycle). |
| FR-006 | Hệ thống phải cho phép Admin, Operator, Viewer giám sát trạng thái thiết bị. |
| FR-007 | Hệ thống phải cung cấp Dashboard cho Admin, Operator, Viewer. |
| FR-008 | Hệ thống phải cho phép xem lịch sử dữ liệu telemetry và danh sách cảnh báo (Admin, Operator, Viewer); nhật ký hoạt động hệ thống (Audit Log) chỉ dành cho Admin. |
| FR-009 | Hệ thống phải cho phép Admin và Operator điều khiển đèn (bật/tắt, PWM). |
| FR-010 | Hệ thống (ESP32) phải tự động thực hiện Adaptive Lighting dựa trên Lux và chuyển động. |
| FR-011 | Hệ thống phải cho phép Admin cấu hình các ngưỡng của Adaptive Lighting. |
| FR-012 | Hệ thống phải cho phép Admin và Operator xử lý cảnh báo (xác nhận, giải quyết). |
| FR-013 | ESP32 phải gửi dữ liệu telemetry (lux, motion, voltage, current, power, pwm) về backend qua MQTT. |
| FR-014 | Backend phải nhận lệnh điều khiển từ Web và gửi xuống ESP32 qua MQTT, đồng thời nhận ACK phản hồi. |
| FR-015 | Backend phải tạo cảnh báo `LAMP_FAULT` khi đèn được yêu cầu bật nhưng dòng điện thấp hơn ngưỡng trong khoảng thời gian xác định. |
| FR-016 | Backend/hệ thống phải tạo cảnh báo `DEVICE_OFFLINE` khi heartbeat của thiết bị bị timeout. |
| FR-017 | Hệ thống phải cho phép Admin cấp và thu hồi quyền truy cập thiết bị cho Operator/Viewer; Operator/Viewer chỉ truy cập thiết bị và dữ liệu của thiết bị được cấp quyền. |
| FR-018 | Hệ thống phải cho phép Admin tạm khóa thiết bị (`MAINTENANCE`) và thu hồi thiết bị (`DECOMMISSIONED`); thiết bị bị khóa/thu hồi không được kết nối MQTT hay gửi dữ liệu. |

## 7. Use Cases

| ID | Name | Actor |
|---|---|---|
| UC01 | Đăng nhập / Đăng xuất | Admin, Operator, Viewer |
| UC02 | Đổi mật khẩu | Admin, Operator, Viewer |
| UC03 | Quản lý User | Admin |
| UC04 | Onboarding thiết bị | Admin |
| UC05 | Quản lý vòng đời thiết bị | Admin |
| UC06 | Giám sát trạng thái thiết bị | Admin, Operator, Viewer |
| UC07 | Xem Dashboard | Admin, Operator, Viewer |
| UC08 | Xem lịch sử dữ liệu và cảnh báo (Audit Log: chỉ Admin) | Admin, Operator, Viewer |
| UC09 | Điều khiển đèn | Admin, Operator |
| UC10 | Adaptive Lighting | System / ESP32 |
| UC11 | Cấu hình Adaptive Lighting | Admin |
| UC12 | Xử lý cảnh báo | Admin, Operator |
| UC13 | Quản lý quyền truy cập thiết bị | Admin |

### UC01 — Đăng nhập / Đăng xuất
- **Actor:** Admin, Operator, Viewer
- **Description:** Người dùng đăng nhập vào hệ thống để truy cập chức năng theo vai trò; có thể đăng xuất để kết thúc phiên làm việc.
- **Preconditions:** UNDEFINED (báo cáo chưa nêu rõ)
- **Expected behavior:** Xác thực thông tin đăng nhập; tạo phiên/token hợp lệ khi thành công.
- **Permission:** Tất cả vai trò.

### UC02 — Đổi mật khẩu
- **Actor:** Admin, Operator, Viewer
- **Description:** Người dùng tự đổi mật khẩu của tài khoản mình.
- **Preconditions:** UNDEFINED
- **Expected behavior:** UNDEFINED (chi tiết validate chưa được báo cáo xác định)
- **Permission:** Tất cả vai trò (trên tài khoản của chính mình).

### UC03 — Quản lý User
- **Actor:** Admin
- **Description:** Admin tạo, cập nhật, khóa/mở tài khoản người dùng.
- **Preconditions:** UNDEFINED
- **Expected behavior:** UNDEFINED (chi tiết flow chưa được báo cáo xác định)
- **Permission:** Chỉ Admin (theo bảng phân quyền 3.5).

### UC04 — Onboarding thiết bị
- **Actor:** Admin
- **Description:** Admin đăng ký thiết bị ESP32 mới vào hệ thống.
- **Preconditions:** UNDEFINED
- **Expected behavior:** Thiết bị mới được tạo với trạng thái lifecycle ban đầu là `REGISTERED`.
- **Permission:** Chỉ Admin.

### UC05 — Quản lý vòng đời thiết bị
- **Actor:** Admin
- **Description:** Admin thay đổi trạng thái vòng đời thiết bị (REGISTERED → PROVISIONED → ACTIVE → MAINTENANCE → DECOMMISSIONED).
- **Preconditions:** UNDEFINED
- **Expected behavior:** Chuyển trạng thái lifecycle theo mô hình đã định nghĩa trong `ARCHITECTURE.md`.
- **Permission:** Chỉ Admin.

### UC06 — Giám sát trạng thái thiết bị
- **Actor:** Admin, Operator, Viewer
- **Description:** Người dùng xem trạng thái hiện tại (device_status) và thông tin thiết bị.
- **Preconditions:** UNDEFINED
- **Expected behavior:** Hiển thị trạng thái ONLINE/OFFLINE/FAULT theo dữ liệu mới nhất.
- **Permission:** Tất cả vai trò.

### UC07 — Xem Dashboard
- **Actor:** Admin, Operator, Viewer
- **Description:** Người dùng xem tổng quan hệ thống trên dashboard.
- **Preconditions:** UNDEFINED
- **Expected behavior:** UNDEFINED (nội dung dashboard chi tiết chưa được báo cáo xác định)
- **Permission:** Tất cả vai trò.

### UC08 — Xem lịch sử dữ liệu và cảnh báo
- **Actor:** Admin, Operator, Viewer (Audit Log: chỉ Admin)
- **Description:** Người dùng xem lịch sử telemetry của thiết bị và danh sách cảnh báo. Riêng nhật ký hoạt động hệ thống (Audit Log) chỉ Admin được xem.
- **Preconditions:** UNDEFINED
- **Expected behavior:**
  - Admin, Operator, Viewer: xem lịch sử telemetry (`GET /devices/:id/telemetry`) và danh sách cảnh báo (`GET /alerts`).
  - Chỉ Admin: xem Audit Log (`GET /audit-logs`).
  - Lịch sử lệnh điều khiển (command history): **TODO** — hiện chưa có endpoint REST tương ứng trong `API_SPEC.md`; không tự thêm khi chưa được xác nhận.
- **Permission:** Telemetry và cảnh báo: tất cả vai trò. Audit Log: chỉ Admin.

### UC09 — Điều khiển đèn
- **Actor:** Admin, Operator
- **Description:** Người dùng gửi lệnh điều khiển đèn (ON/OFF/PWM) từ giao diện Web.
- **Preconditions:** UNDEFINED
- **Expected behavior:** Lệnh được gửi qua MQTT tới ESP32, ESP32 phản hồi ACK. Lệnh thủ công tạm thời ghi đè Adaptive Lighting (quy tắc chi tiết: `ARCHITECTURE.md` mục 7).
- **Permission:** Admin, Operator (Viewer **không** có quyền này — xem Business Rules).

### UC10 — Adaptive Lighting
- **Actor:** System / ESP32
- **Description:** Hệ thống (ESP32) tự động điều chỉnh độ sáng LED dựa trên Lux và chuyển động, theo ngưỡng lưu trong `adaptive_config`.
- **Preconditions:** UNDEFINED
- **Expected behavior:** Xem bảng ngưỡng PWM tham khảo và quy tắc ghi đè bởi lệnh thủ công trong `ARCHITECTURE.md` mục Adaptive Lighting.
- **Permission:** Đây là chức năng tự động của hệ thống; người dùng **không có quyền** cấu hình rule trực tiếp trong UC10 (chỉ cấu hình qua UC11).

### UC11 — Cấu hình Adaptive Lighting
- **Actor:** Admin
- **Description:** Admin cấu hình các ngưỡng của Adaptive Lighting (`adaptive_config`).
- **Preconditions:** UNDEFINED
- **Expected behavior:** UNDEFINED (chi tiết flow cấu hình chưa được báo cáo xác định)
- **Permission:** Chỉ Admin.

### UC12 — Xử lý cảnh báo
- **Actor:** Admin, Operator
- **Description:** Người dùng xác nhận (acknowledge) hoặc giải quyết (resolve) cảnh báo.
- **Preconditions:** UNDEFINED
- **Expected behavior:** UNDEFINED
- **Permission:** Admin, Operator (Viewer không có quyền — xem Business Rules).

### UC13 — Quản lý quyền truy cập thiết bị
- **Actor:** Admin
- **Description:** Admin cấp hoặc thu hồi quyền truy cập một thiết bị cho user có vai trò Operator/Viewer.
- **Preconditions:** UNDEFINED
- **Expected behavior:** Admin đặt danh sách user được truy cập thiết bị qua `PUT /devices/:id/access`; từ đó Operator/Viewer chỉ thấy và thao tác trên thiết bị được cấp. Thiết bị không được cấp trả `404`.
- **Permission:** Chỉ Admin.

## 8. Business Rules

- Viewer không được điều khiển đèn.
- Viewer không được xử lý cảnh báo (chỉ Admin/Operator).
- Admin có quyền cấu hình Adaptive Lighting; các vai trò khác không có quyền này.
- Adaptive Lighting là chức năng tự động của hệ thống; người dùng không có quyền cấu hình rule trực tiếp trong UC10.
- Mỗi thiết bị phải có identity riêng (`device_id` và `credential_hash`).
- Thiết bị offline phải được phát hiện (qua heartbeat timeout) và sinh cảnh báo `DEVICE_OFFLINE`.
- Cảnh báo `LAMP_FAULT` được tạo khi điều kiện lỗi thỏa mãn: **[ĐÃ BỔ SUNG]** Khi mức PWM yêu cầu $\ge 30\%$ nhưng dòng điện tiêu thụ đo được từ INA219 thấp hơn ngưỡng $I < 0.05\text{A}$ ($50\text{mA}$) duy trì liên tục trong thời gian $T \ge 5\text{ giây}$.
  - *Lý do/Rationale:* Khi PWM ở mức thấp (0–20% theo bảng Adaptive Lighting khi không có người), dòng tải LED rất nhỏ dễ gây báo động giả (false positive); quy định chỉ kiểm tra lỗi khi $PWM \ge 30\%$ đảm bảo đèn đang trong trạng thái tải sáng rõ rệt. Khoảng thời gian $5\text{s}$ giúp lọc nhiễu và bỏ qua hiện tượng quá độ (transient/inrush) khi vừa bật hoặc chuyển mức độ sáng.
- Chỉ Admin được: quản lý User, onboarding Device, quản lý vòng đời Device, cấu hình Adaptive Lighting, cấp/thu hồi quyền truy cập thiết bị.
- Admin và Operator đều được: giám sát Device, xem Dashboard, xem lịch sử telemetry và cảnh báo, điều khiển đèn, xử lý cảnh báo (Operator: chỉ trên thiết bị được cấp quyền).
- Viewer chỉ được: đăng nhập/đăng xuất, đổi mật khẩu, giám sát Device, xem Dashboard, xem lịch sử telemetry và cảnh báo (chỉ trên thiết bị được cấp quyền).
- Chỉ Admin được xem Audit Log (`GET /audit-logs`).
- Backend kiểm tra RBAC tại API, không chỉ ẩn nút trên giao diện.
- **[ĐÃ BỔ SUNG]** Admin truy cập mọi thiết bị; Operator/Viewer chỉ truy cập thiết bị có bản ghi `DEVICE_ACCESS`. Truy cập thiết bị không được cấp trả `404` (không lộ sự tồn tại); endpoint danh sách chỉ trả thiết bị được phép.
- **[ĐÃ BỔ SUNG]** `assigned_user_id` là người phụ trách thiết bị, không dùng để phân quyền.
- **[ĐÃ BỔ SUNG]** Thiết bị `MAINTENANCE` (tạm khóa) và `DECOMMISSIONED` (thu hồi vĩnh viễn) không được kết nối MQTT và không sinh cảnh báo `DEVICE_OFFLINE`; thiết bị `PROVISIONED` được phép kết nối lần đầu.

### Permission Matrix (vai trò × endpoint) [ĐÃ BỔ SUNG]

Ký hiệu: ✓ = được; **S** = chỉ trên thiết bị được cấp quyền (`DEVICE_ACCESS`); ✗ = bị từ chối `403`.

| Endpoint | Admin | Operator | Viewer |
|---|---|---|---|
| `POST /auth/login`, `POST /auth/refresh` | Public | Public | Public |
| `POST /auth/logout`, `PUT /auth/password` | ✓ | ✓ | ✓ |
| `GET /users`, `POST /users`, `PUT /users/:id`, `PATCH /users/:id/status` | ✓ | ✗ | ✗ |
| `GET /devices`, `GET /devices/:id` | ✓ (tất cả) | S | S |
| `POST /devices`, `PUT /devices/:id` | ✓ | ✗ | ✗ |
| `PATCH /devices/:id/lifecycle` | ✓ | ✗ | ✗ |
| `PATCH /devices/:id/config` | ✓ | ✗ | ✗ |
| `GET /devices/:id/access`, `PUT /devices/:id/access` | ✓ | ✗ | ✗ |
| `GET /devices/:id/telemetry`, `GET /devices/:id/telemetry/latest` | ✓ (tất cả) | S | S |
| `POST /devices/:id/commands` | ✓ (tất cả) | S | ✗ |
| `GET /alerts` | ✓ (tất cả) | S | S |
| `PATCH /alerts/:id/acknowledge`, `PATCH /alerts/:id/resolve` | ✓ (tất cả) | S | ✗ |
| `GET /dashboard/summary`, `GET /dashboard/devices` | ✓ (tất cả) | S | S |
| `GET /audit-logs` | ✓ | ✗ | ✗ |
| Socket.IO: `telemetry:update`, `device:status`, `command:update`, `alert:new` | ✓ (tất cả) | S | S |

- Thứ tự kiểm tra: `401` (token) → `403` (role) → `404` (phạm vi thiết bị) → `400` (validate) → `409` (trạng thái). Chi tiết: `API_SPEC.md` mục "Quy ước chung về lỗi và phạm vi truy cập".
- Mỗi ô ✗ và mỗi ô **S** cần ít nhất một test RBAC tương ứng.
- Thiết bị bị khóa/revoke/decommission không được tiếp tục hoạt động hợp lệ trên hệ thống.

## 9. Non-functional Requirements

- **Reliability:** thiết bị phải có heartbeat, hệ thống phải phát hiện offline và thiết bị phải tự reconnect khi mạng khôi phục.
- **Security:** mật khẩu phải được băm (bcryptjs); API phải xác thực (JWT); backend phải kiểm tra quyền (RBAC) tại API.
- **Performance/Latency:** độ trễ của telemetry và lệnh điều khiển cần được theo dõi trong kiểm thử. Số liệu mục tiêu cụ thể: **UNDEFINED** (báo cáo để trống, chờ đo thực tế — xem mục "Đo thực tế" trong báo cáo gốc, chương 4.2.2).
- **Reconnect:** thiết bị phải tự động kết nối lại khi mất kết nối mạng.
- **Device identity:** mỗi ESP32 có `device_id` và credential riêng.
- **Maintainability:** UNDEFINED (không có yêu cầu cụ thể trong báo cáo ngoài kiến trúc modular monolith — xem `ARCHITECTURE.md`).
- **Safety:** sử dụng nguồn DC 12V cho LED, tránh đấu nối trực tiếp vào điện lưới.
- **Cost constraints:** ưu tiên các module phổ biến, dễ thay thế và phù hợp với quy mô prototype.
- **Privacy:** hệ thống không thu thập camera, microphone hoặc dữ liệu vị trí cá nhân. Dữ liệu chính là dữ liệu cảm biến, trạng thái thiết bị và nhật ký hoạt động phục vụ vận hành.

## 10. Acceptance Criteria

> Báo cáo gốc chưa có kết quả kiểm thử thực tế (mục 4.2 để trống, các ô "Kết quả" và "Đo thực tế" chưa điền). Do đó acceptance criteria dưới đây được suy ra trực tiếp từ mô tả test case (TC01–TC10) trong báo cáo, không kèm số liệu định lượng.

| Liên quan đến | Tiêu chí chấp nhận (suy ra từ TC tương ứng) |
|---|---|
| TC01 | Đăng nhập thành công với từng vai trò Admin/Operator/Viewer; quyền truy cập đúng theo vai trò. |
| TC02 | Có thể tạo thiết bị mới (ví dụ `LIGHT-001`) và kích hoạt (onboarding) thành công. |
| TC03 | ESP32 gửi được dữ liệu Lux/Motion/Power qua MQTT và backend nhận được. |
| TC04 | Dashboard cập nhật dữ liệu mới theo thời gian thực (qua Socket.IO). |
| TC05 | Lệnh ON/OFF/PWM được gửi và ESP32 phản hồi ACK đúng. |
| TC06 | Khi Lux/Motion thay đổi, giá trị PWM thay đổi theo bảng ngưỡng Adaptive Lighting. |
| TC07 | Khi ngắt Wi-Fi của thiết bị, hệ thống ghi nhận trạng thái OFFLINE. |
| TC08 | Khi dòng điện thấp bất thường lúc LED ON, hệ thống tạo cảnh báo Lamp Fault. |
| TC09 | Viewer gọi API điều khiển (command) phải bị từ chối (unauthorized). |
| TC10 | Decommission thiết bị thành công và thiết bị không còn hoạt động hợp lệ trên broker/backend. |
| TC11 | Operator/Viewer gọi `GET /devices/:id` của thiết bị không được cấp quyền (ví dụ thiết bị mô phỏng `LIGHT-002`) nhận `404`; `GET /devices` không liệt kê thiết bị đó. |
| TC12 | Gọi API với JWT không hợp lệ hoặc hết hạn nhận `401`. |
| TC13 | Thiết bị chuyển `MAINTENANCE` bị broker từ chối kết nối/không gửi được dữ liệu và không sinh cảnh báo `DEVICE_OFFLINE`. |
| TC14 | Thiết bị publish lên topic của thiết bị khác bị broker từ chối. |

Số liệu định lượng cho các chỉ tiêu phi chức năng (độ trễ sensor→dashboard, độ trễ command→ACK, tỷ lệ mất bản tin, thời gian reconnect, ổn định liên tục): **TODO — chờ đo thực tế**, chưa có trong báo cáo gốc.
