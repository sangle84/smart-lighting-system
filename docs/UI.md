# UI — Smart Lighting System

> Tài liệu này mô tả cấu trúc, hành vi và quy tắc giao diện Web của Smart Lighting System.
>
> **UI.md không phải source of truth cho requirements, API, database hoặc architecture.**
> - Requirements: `docs/PRD.md`
> - Architecture: `docs/ARCHITECTURE.md`
> - REST/MQTT contract: `docs/API_SPEC.md`
> - Database: `docs/DATABASE.md`
> - Development rules: `docs/PROJECT-RULES.md`
>
> Những nội dung chưa được các tài liệu nguồn xác định rõ được đánh dấu `TODO/UNDEFINED`, không tự suy diễn thành requirement chính thức.

---

## 1. Scope

Frontend sử dụng:

- React
- TypeScript
- Vite
- Tailwind CSS
- Socket.IO cho realtime
- Recharts cho biểu đồ

Frontend chỉ giao tiếp với Backend qua REST/Socket.IO; không truy cập trực tiếp PostgreSQL hoặc MQTT Broker.

Hệ thống là prototype phạm vi hẹp với 1 node ESP32.

---

## 2. UI Design Principles

### 2.1 Dashboard-first

Dashboard là màn hình giám sát chính cho cả ba vai trò:

- Admin
- Operator
- Viewer

Dashboard tập trung vào:

- trạng thái thiết bị;
- telemetry hiện tại;
- trạng thái chiếu sáng;
- cảnh báo;
- dữ liệu lịch sử/realtime cần thiết cho việc giám sát.

### 2.2 Role-aware UI

UI phải thay đổi theo quyền của người dùng.

| Vai trò | UI chính |
|---|---|
| Admin | Dashboard, User Management, Device Management, Device Control, Adaptive Lighting Configuration, Alerts, Telemetry History, Audit Log |
| Operator | Dashboard, Device Monitoring, Device Control, Alerts, Telemetry History |
| Viewer | Dashboard, Device Monitoring, Alerts/Telemetry History ở chế độ xem |

> UI chỉ hỗ trợ trải nghiệm theo role. Backend vẫn phải kiểm tra RBAC; frontend không được coi việc ẩn nút là cơ chế bảo mật.

### 2.3 Source of truth

REST/Database là source of truth của dữ liệu.

Socket.IO chỉ dùng để cập nhật realtime. Client không được giả định rằng việc nhận event Socket.IO đồng nghĩa dữ liệu đã được lưu hoặc luôn có thể nhận lại event đã bỏ lỡ.

Khi client reload/reconnect:

1. lấy trạng thái/dữ liệu cần thiết qua REST;
2. sau đó tiếp tục nhận cập nhật realtime qua Socket.IO.

---

## 3. Global Layout

### 3.1 App shell

Sau khi đăng nhập, giao diện gồm:

- Sidebar/navigation.
- Topbar.
- Main content area.

Chi tiết visual như kích thước sidebar, màu sắc, typography, spacing và design tokens:

`TODO/UNDEFINED`

### 3.2 Topbar

Topbar nên hiển thị:

- tên người dùng;
- role hiện tại;
- thao tác logout;
- khu vực hiển thị trạng thái/realtime nếu cần.

Chi tiết component và visual treatment:

`TODO/UNDEFINED`

### 3.3 Navigation

Navigation phải dựa trên role.

Không hiển thị các chức năng không thuộc quyền của user khi điều đó cải thiện UX, nhưng việc ẩn menu không thay thế backend authorization.

---

## 4. Authentication UI

### 4.1 Login

Màn hình Login phải hỗ trợ:

- username;
- password;
- thông báo lỗi khi đăng nhập thất bại;
- chuyển vào ứng dụng khi authentication thành công.

API tương ứng:

- `POST /auth/login`

Access Token:

- lưu trong memory ở phía client.

Refresh Token:

- lưu trong HttpOnly Cookie.

Khi Access Token hết hạn:

- client gọi `POST /auth/refresh`;
- nhận Access Token mới;
- tiếp tục request được bảo vệ.

### 4.2 Logout

API:

- `POST /auth/logout`

Sau logout:

- xóa trạng thái authentication ở client;
- đưa user về Login.

### 4.3 Change Password

Màn hình đổi mật khẩu dành cho mọi role trên chính tài khoản của mình.

API:

- `PUT /auth/password`

UI cần có ít nhất:

- current password;
- new password;
- confirm new password.

Validation cụ thể ngoài contract hiện có:

`TODO/UNDEFINED`

---

## 5. Dashboard

Dashboard dành cho:

- Admin
- Operator
- Viewer

### 5.1 Device status

Hiển thị:

- device name / device id;
- lifecycle status;
- device status;
- last seen;
- firmware version nếu cần cho monitoring.

`device_status` có các giá trị:

- `ONLINE`
- `OFFLINE`
- `FAULT`

`lifecycle_status` có các giá trị:

- `REGISTERED`
- `PROVISIONED`
- `ACTIVE`
- `MAINTENANCE`
- `DECOMMISSIONED`

Không gộp hai loại trạng thái này thành một field/UI state.

### 5.2 Current telemetry

Dashboard hiển thị telemetry mới nhất:

- lux;
- motion;
- voltage;
- current;
- power;
- pwm;
- timestamp.

Nguồn dữ liệu chính:

- `GET /devices/:id/telemetry/latest`

Realtime:

- `telemetry:update`

### 5.3 Lighting state

Dashboard có thể hiển thị:

- PWM hiện tại;
- trạng thái bật/tắt;
- device status;
- thông tin override nếu phù hợp với UI.

Chi tiết visual của trạng thái ON/OFF/PWM:

`TODO/UNDEFINED`

### 5.4 Alerts summary

Dashboard có thể hiển thị cảnh báo mới/gần đây.

Alert hiện có các trạng thái:

- `NEW`
- `ACKNOWLEDGED`
- `RESOLVED`

Alert types hiện được mô tả trong docs gồm các trường hợp như:

- `LAMP_FAULT`
- `DEVICE_OFFLINE`

Realtime event:

- `alert:new`

### 5.5 Charts

Dùng Recharts.

Các dữ liệu có thể biểu diễn:

- lux theo thời gian;
- current/power theo thời gian;
- PWM theo thời gian.

Loại biểu đồ cụ thể, khoảng thời gian mặc định và số điểm hiển thị:

`TODO/UNDEFINED`

---

## 6. Device Management

### 6.1 Device list

Admin có quyền quản lý thiết bị.

Danh sách có thể hỗ trợ:

- device id;
- name;
- location;
- device status;
- lifecycle status;
- last seen.

API:

- `GET /devices`

Các bộ lọc/query đã được xác định trong API contract phải được dùng theo `API_SPEC.md`.

### 6.2 Device detail

Trang chi tiết thiết bị dùng để:

- xem thông tin thiết bị;
- xem status;
- xem latest telemetry;
- truy cập control/configuration khi role có quyền.

### 6.3 Device onboarding

Chỉ Admin.

API:

- `POST /devices`

Sau khi onboarding thành công, backend trả `device_key` plaintext để provision thiết bị.

UI phải xử lý đây như secret nhạy cảm và không hiển thị lại sau lần onboarding đó.

Cách UX cụ thể để hiển thị/copy/download device key:

`TODO/UNDEFINED`

### 6.4 Lifecycle management

Chỉ Admin.

UI phải phản ánh lifecycle state machine được định nghĩa trong `ARCHITECTURE.md`.

Không tự thêm transition mới ngoài contract hiện có.

---

## 7. Device Control

Quyền:

- Admin
- Operator

Viewer không có quyền điều khiển.

API:

- `POST /devices/:id/commands`

Command types:

- `PWM`
- `ON`
- `OFF`

### 7.1 PWM control

UI cần cho phép nhập PWM trong khoảng:

- `0–100%`

Có thể dùng:

- slider;
- numeric input;
- hoặc tổ hợp cả hai.

Component cụ thể:

`TODO/UNDEFINED`

### 7.2 ON/OFF control

UI cung cấp control cho:

- ON
- OFF

Semantics của ON/OFF phải tuân thủ `API_SPEC.md`.

Sau reboot, nếu `last_manual_pwm` chưa tồn tại thì ON sử dụng PWM mặc định theo contract đã chốt.

### 7.3 Command state

UI nên phản ánh trạng thái xử lý lệnh:

- `PENDING`
- `SENT`
- `ACKNOWLEDGED`
- `FAILED`
- `TIMEOUT`

Realtime event:

- `command:update`

Chi tiết hiển thị command history vẫn `TODO`, vì API lịch sử command chưa được xác định.

---

## 8. Manual Override UI

Manual control phải phản ánh quy tắc:

- lệnh thủ công thành công có thể tạo manual override;
- Adaptive Lighting không ghi đè override cho tới khi effective motion thay đổi;
- sau đó adaptive control có thể hoạt động trở lại.

UI có thể hiển thị trạng thái:

- Adaptive;
- Manual Override.

Tên label cụ thể và visual indicator:

`TODO/UNDEFINED`

`manual_override` và `last_manual_pwm` hiện là trạng thái RAM Phase 1, không persist qua reboot.

---

## 9. Adaptive Lighting Configuration

Chỉ Admin.

API:

- `PATCH /devices/:id/config`

UI cho phép cấu hình:

- enabled;
- motion timeout;
- lux thresholds;
- PWM tương ứng;
- no-motion PWM.

Các ngưỡng đã có trong contract hiện tại không được tự ý thay đổi khi implement.

UI nên ưu tiên editor trực quan nhưng phải giữ nguyên giá trị dữ liệu mà API contract yêu cầu.

Layout editor cụ thể:

`TODO/UNDEFINED`

---

## 10. Telemetry History

Quyền:

- Admin
- Operator
- Viewer

API:

- `GET /devices/:id/telemetry`

UI nên hỗ trợ:

- bảng dữ liệu;
- biểu đồ;
- chọn khoảng thời gian nếu API hỗ trợ;
- xem timestamp và các giá trị sensor/actuator.

Filter/pagination/sort phải tuân theo API contract.

Chi tiết bộ lọc UI:

`TODO/UNDEFINED`

---

## 11. Alerts

Quyền xem:

- Admin
- Operator
- Viewer

Quyền xử lý:

- Admin
- Operator

### 11.1 Alert list

API:

- `GET /alerts`

Nên hiển thị:

- alert type;
- severity;
- message;
- device;
- status;
- created_at.

### 11.2 Acknowledge

API:

- `PATCH /alerts/:id/acknowledge`

### 11.3 Resolve

API:

- `PATCH /alerts/:id/resolve`

Viewer không được thấy control action có thể thực hiện acknowledge/resolve.

### 11.4 Realtime

Event:

- `alert:new`

UI phải có cơ chế cập nhật alert mới mà không cần reload trang.

Chi tiết notification/toast/popup:

`TODO/UNDEFINED`

---

## 12. User Management

Chỉ Admin.

Các chức năng theo PRD:

- tạo user;
- cập nhật user;
- khóa/mở tài khoản.

Danh sách role:

- Admin
- Operator
- Viewer

UI không tự tạo role mới.

Form validation chi tiết:

`TODO/UNDEFINED`

---

## 13. Audit Log

Chỉ Admin.

API:

- `GET /audit-logs`

UI phục vụ việc xem nhật ký hoạt động hệ thống.

Lịch sử command chưa có endpoint REST chính thức nên không tự tạo page riêng cho command history.

---

## 14. Realtime UI Behavior

Socket.IO được dùng để nhận cập nhật realtime từ Backend.

Các event UI contract:

| Event | UI behavior |
|---|---|
| `telemetry:update` | Cập nhật telemetry đang hiển thị |
| `device:status` | Cập nhật device status / last seen |
| `command:update` | Cập nhật trạng thái/result của command đang xử lý |
| `alert:new` | Thêm alert mới vào giao diện |

Payload phải tái sử dụng schema đã được định nghĩa trong `API_SPEC.md`; UI không tự tạo một schema JSON khác.

### 14.1 Socket.IO authentication

Client Socket.IO phải được xác thực.

Behavior kiểm thử bắt buộc:

- client không có JWT hợp lệ bị từ chối kết nối;
- client hợp lệ có thể nhận event theo quyền được phép.

Cơ chế truyền JWT cụ thể trong Socket.IO handshake:

`TODO/UNDEFINED`

### 14.2 Reconnect

Khi Socket.IO reconnect:

- client không coi event bị bỏ lỡ là dữ liệu đã được đồng bộ;
- client lấy lại source-of-truth cần thiết từ REST;
- sau đó tiếp tục nhận realtime event.

---

## 15. Loading / Empty / Error States

Mọi page lấy dữ liệu qua REST phải có trạng thái:

- loading;
- empty;
- error;
- success.

Không để UI trắng không có giải thích khi request thất bại.

Copy/text cụ thể của từng trạng thái:

`TODO/UNDEFINED`

---

## 16. Confirmation & Destructive Actions

Các hành động có khả năng thay đổi trạng thái quan trọng nên có confirmation phù hợp.

Ví dụ:

- decommission device;
- lock user;
- unlock user nếu cần;
- resolve alert nếu UX yêu cầu.

Nội dung modal, mức độ confirmation và button labels:

`TODO/UNDEFINED`

---

## 17. Responsive Behavior

Frontend là Web UI.

Behavior responsive cụ thể trên:

- desktop;
- tablet;
- mobile browser;

`TODO/UNDEFINED`

Không mở rộng thành mobile app riêng vì mobile app riêng nằm ngoài scope hiện tại.

---

## 18. Accessibility

Mức accessibility chi tiết:

`TODO/UNDEFINED`

Tối thiểu không được làm các control chính chỉ có icon mà không có accessible label.

---

## 19. Visual Design & Theme Guidelines (Blue + Gray)

> **Hướng dẫn cho Agent:** Toàn bộ giao diện sử dụng giao diện sáng (Light mode, không cần Dark mode), phong cách kỹ thuật IoT hiện đại với bảng màu chủ đạo **Blue + Gray** (Tailwind CSS: `blue` + `slate`/`gray`).

### 19.1 Color Palette & Theme Tokens

| Token | Tên màu / Mục đích | Tailwind CSS Classes | Hex Code |
|---|---|---|---|
| **Primary (Brand)** | Blue 600 (Nút bấm chính, active state, link, primary action) | `bg-blue-600 hover:bg-blue-700 text-white` | `#2563EB` |
| **Primary Light** | Blue 50 / 100 (Background badge nhẹ, hover menu, row select) | `bg-blue-50 text-blue-700` | `#EFF6FF` / `#DBEAFE` |
| **Primary Border** | Blue 200 / 300 (Border active, focus ring) | `border-blue-500 focus:ring-blue-500` | `#93C5FD` / `#3B82F6` |
| **Base Background** | Slate 50 (Nền tổng thể toàn bộ trang) | `bg-slate-50` | `#F8FAFC` |
| **Surface / Card** | White (Nền bảng, card nội dung, popup, modal) | `bg-white` | `#FFFFFF` |
| **Border / Divider**| Slate 200 (Đường kẻ phân cách, viền card, viền input) | `border-slate-200` | `#E2E8F0` |
| **Text Main** | Slate 900 (Tiêu đề, text chính, số liệu quan trọng) | `text-slate-900` | `#0F172A` |
| **Text Muted** | Slate 600 (Nội dung mô tả, nhãn phụ, header bảng) | `text-slate-600` | `#475569` |
| **Text Placeholder**| Slate 400 (Placeholder input, icon không active) | `text-slate-400` | `#94A3B8` |

### 19.2 Status & Alert Colors

Mapping màu trạng thái thiết bị và cảnh báo chuẩn hóa cho Agent:

| Trạng thái | Ý nghĩa | Tailwind CSS Classes (Badge / Indicator) | Hex tham chiếu |
|---|---|---|---|
| **ONLINE** | Thiết bị kết nối bình thường | `bg-emerald-50 text-emerald-700 border-emerald-200` / dot: `bg-emerald-500` | `#10B981` |
| **OFFLINE** | Mất kết nối / Không phản hồi | `bg-slate-100 text-slate-700 border-slate-300` / dot: `bg-slate-400` | `#64748B` |
| **FAULT** / **CRITICAL** | Sự cố đèn, quá dòng, lỗi phần cứng | `bg-rose-50 text-rose-700 border-rose-200` / dot: `bg-rose-500` | `#EF4444` |
| **WARNING** / **NEW** | Cảnh báo mới phát sinh | `bg-amber-50 text-amber-700 border-amber-200` / dot: `bg-amber-500` | `#F59E0B` |
| **ACKNOWLEDGED** | Cảnh báo đã được xác nhận tiếp nhận | `bg-blue-50 text-blue-700 border-blue-200` / dot: `bg-blue-500` | `#3B82F6` |
| **RESOLVED** | Cảnh báo đã được xử lý xong | `bg-teal-50 text-teal-700 border-teal-200` / dot: `bg-teal-500` | `#14B8A6` |

### 19.3 Typography & Metrics

- **Font Family:** `Inter`, `system-ui`, `-apple-system`, `sans-serif`.
- **Heading Scale:**
  - Page Title: `text-2xl font-bold text-slate-900`
  - Section / Card Title: `text-lg font-semibold text-slate-800`
  - Subtitle / Label: `text-sm font-medium text-slate-700`
- **Data & Telemetry Values:** `text-2xl` hoặc `text-3xl font-bold font-mono text-slate-900` kèm đơn vị `text-sm font-normal text-slate-500`.

### 19.4 Component Library Guidelines cho Agent

- **Button Primary:** `px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50`
- **Button Secondary / Outline:** `px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors`
- **Card:** `bg-white border border-slate-200 rounded-xl shadow-sm p-5`
- **Input / Select:** `w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm`
- **Table:** Header `bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider`; Row hover `hover:bg-slate-50/80 transition-colors`; Border `border-b border-slate-200`
- **Slider (PWM Dimming):** Thanh trượt điều khiển độ sáng dùng màu Blue 600 `accent-blue-600`.

---

## 20. Visual References

Hiện chưa có ảnh UI chính thức.

Không dùng screenshot hoặc mockup bên ngoài làm implementation requirement nếu chưa được xác nhận.

Khi có mockup chính thức, đặt tại:

```text
docs/ui/design/
```

Ví dụ:

```text
docs/ui/design/
├── login.png
├── dashboard.png
├── device-list.png
├── device-detail.png
├── alerts.png
├── telemetry-history.png
├── user-management.png
├── adaptive-config.png
└── audit-log.png
```

Trong `UI.md`, mỗi ảnh cần được ghi rõ là:

- `Design Reference`; hoặc
- `Implementation Evidence`.

Không coi ảnh là source of truth cho API/database/permission nếu text contract không nói như vậy.

---

## 21. Implementation Evidence

Screenshot giao diện đã triển khai thực tế có thể đặt tại:

```text
docs/ui/evidence/
```

Ví dụ:

```text
docs/ui/evidence/
├── login-v1.png
├── dashboard-v1.png
└── device-control-v1.png
```

Evidence chỉ dùng để chứng minh implementation thực tế; không tự biến screenshot thành requirement mới.

---

## 22. Open UI Decisions

Các điểm hiện chưa được xác định đầy đủ:

| Nội dung | Trạng thái |
|---|---|
| Visual identity / color palette | ĐÃ XÁC ĐỊNH: Theme Blue + Gray (Light mode, không dark mode) |
| Typography | ĐÃ XÁC ĐỊNH: Inter/system-ui; Text Slate-900, Subtitle Slate-600 |
| Exact sidebar/topbar layout | TODO/UNDEFINED |
| Socket.IO JWT handshake mechanism | TODO/UNDEFINED |
| Socket.IO room/broadcast scope | TODO/UNDEFINED |
| Exact chart types/time ranges | TODO/UNDEFINED |
| Exact control component for PWM | ĐÃ XÁC ĐỊNH: Slider kèm input % (accent-blue-600) |
| Alert toast/notification behavior | TODO/UNDEFINED |
| Responsive breakpoints | TODO/UNDEFINED |
| Detailed accessibility rules | TODO/UNDEFINED |
| Command history page | TODO — chưa có REST endpoint chính thức |

---

## 23. UI Implementation Rules

- Không tự ý thêm chức năng ngoài `PRD.md`.
- Không tự ý thay đổi RBAC.
- Không tự ý tạo endpoint mới chỉ để phục vụ UI.
- Không truy cập PostgreSQL hoặc MQTT trực tiếp từ Frontend.
- UI phải dùng REST/Socket.IO theo `API_SPEC.md`.
- Backend authorization luôn là security boundary.
- Dữ liệu realtime phải tuân thủ Socket.IO contract.
- Khi contract chưa xác định, dùng `TODO/UNDEFINED`, không biến assumption thành requirement chính thức.
- Khi UI thay đổi API/database/architecture, cập nhật tài liệu tương ứng theo `PROJECT-RULES.md`.
