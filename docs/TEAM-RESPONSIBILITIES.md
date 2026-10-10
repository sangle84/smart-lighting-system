# Team Responsibilities

> File này là tài liệu quản lý ownership, phạm vi trách nhiệm và quy tắc bàn giao giữa hai thành viên trong dự án Smart Lighting System.  
> File này không thay thế các contract kỹ thuật trong `docs/API_SPEC.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md` và `docs/PRD.md`.  
> `PLAN.md` vẫn là nơi ghi tiến độ và bằng chứng nghiệm thu; `TEAM-RESPONSIBILITIES.md` chỉ mô tả ai làm gì và ai chịu trách nhiệm chính ở từng phần.

## 1. Mục tiêu và phạm vi

- Thành viên 1: `Sang`
  - Chịu trách nhiệm chính cho Backend Foundation.
  - Bao gồm database/schema, auth, JWT, RBAC, REST API, deployment và tích hợp cuối.
- Thành viên 2: `Thinh`
  - Chịu trách nhiệm chính cho Realtime & Frontend.
  - Bao gồm MQTT Integration, Socket.IO realtime, frontend core và các flow người dùng.

Phạm vi hiện tại không bao gồm firmware ESP32 phần cứng theo kế hoạch tạm hoãn của nhóm. Khi firmware được kích hoạt lại, cần có phân công rõ ràng mới và phải cập nhật file này.

## 2. Bảng phân công theo giai đoạn

| Giai đoạn | Tên giai đoạn | Owner chính | Người phối hợp / review |
|---|---|---|---|
| 1 | Database & Schema | Sang | Thinh review schema theo telemetry, device access và dashboard requirements |
| 2 | Backend Core (Auth, JWT, RBAC) | Sang | Thinh review quyền cho frontend và control flow |
| 3 | MQTT Integration | Thinh | Sang review thiết kế xác thực thiết bị và ACL |
| 4 | REST API | Sang | Thinh review payload và giao diện với frontend |
| 5 | Socket.IO Realtime | Thinh | Sang review access control và dữ liệu security |
| 6 | Frontend Core | Thinh | Sang review API contract và RBAC UI |
| 8 | Deployment & Environment | Sang | Thinh bàn giao module và cấu hình runtime |
| 9 | Testing & Integration | Chia theo module, chủ trì bởi owner từng phần | Cả hai cùng review end-to-end |

> Lưu ý: Giai đoạn 7 (Firmware ESP32) đang tạm hoãn theo phạm vi hiện tại.

## 3. Chi tiết đầu việc từng thành viên

### 3.1 Sang — Backend Foundation

Owner chính cho:
- Database schema và migration
- Seed data và constraints
- Auth, JWT, refresh token và logout
- RBAC, user roles, device access management
- REST API (devices, commands, alerts, dashboard, audit)
- Deployment environment và Docker Compose
- Tổng hợp evidence và kiểm thử backend

Sản phẩm bàn giao cần có:
- Migration SQL chạy thành công
- Seed dữ liệu phù hợp contract
- API endpoints đã chạy được theo spec
- Bằng chứng test và log kiểm tra

### 3.2 Thinh — Realtime & Frontend

Owner chính cho:
- MQTT Integration
- Telemetry, command handling, retry/dedup logic
- Socket.IO realtime server và danh sách event
- Frontend login, dashboard, control page, alerts
- Kết nối frontend với REST API và Realtime event

Sản phẩm bàn giao cần có:
- MQTT simulator hoặc flow test đã chạy
- Realtime event nhận đúng payload và scoped theo quyền
- Frontend login/dashboard/control hoạt động với backend thật
- Bằng chứng kiểm thử riêng theo module

## 4. Sản phẩm bàn giao

Mỗi thành viên phải bàn giao theo chuẩn sau:

- Code thay đổi trên nhánh riêng
- Mô tả chức năng đã hoàn thành
- Link hoặc tên file chính đã sửa
- Kết quả test đã chạy
- Lỗi còn lại hoặc item chưa đạt Done
- Dự liệu cần review từ bên kia trước khi merge hoặc tích hợp

Điểm bàn giao quan trọng:
- Sang phải bàn giao contract cơ sở cho Thinh: DB schema, auth, RBAC, REST API contract.
- Thinh phải bàn giao module thực thi cho Sang: MQTT flow, realtime event, frontend UX và test evidence.
- Mọi thay đổi ảnh hưởng contract hoặc endpoint phải được thông báo trước khi triển khai.

## 5. Quy tắc phối hợp

### 5.1 Quy tắc về contract

- Các file kỹ thuật là nguồn quyết định:
  - `docs/API_SPEC.md`
  - `docs/DATABASE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRD.md`
- Mọi thay đổi liên quan đến API, database, MQTT, quyền truy cập hoặc trạng thái thiết bị phải được đồng review trước khi merge.
- Không thay đổi contract ở code mà không cập nhật tài liệu tương ứng.

### 5.2 Quy tắc về bàn giao module

- Thinh có thể bắt đầu frontend và MQTT với mock data/simulator nếu backend chưa hoàn tất.
- Sang không được đánh dấu module của mình là Done nếu chưa có bằng chứng runtime thực tế.
- End-to-end phải do cả hai cùng xác nhận khi đến Giai đoạn 8/9.

### 5.3 Quy tắc review chéo

- Mỗi task có thể bắt đầu trên nhánh của người phụ trách chính.
- Nếu task chạm tới module của thành viên còn lại, cần có review chéo trước khi merge.
- Nếu một thay đổi ảnh hưởng đến cả hai bên, phải ghi rõ: mục đích, file affected, risk, và bằng chứng test liên quan.

### 5.4 Quy tắc Git branch

- Không code trực tiếp lên `main`.
- Chỉ dùng 2 nhánh chính của nhóm: `Sang` và `Thinh`.
- Không tạo nhánh con dưới dạng `Sang/<task-name>` hoặc `Thinh/<task-name>`.
- Trước khi bắt đầu task, phải pull/fetch code mới nhất của branch hiện tại để cập nhật trạng thái cùng repo và tránh xung đột với người khác.
- Nếu hiện đang ở nhánh `main`, phải tạo nhánh mới theo tên người phụ trách: `Sang` hoặc `Thinh`, rồi bắt đầu làm việc.
- Mỗi người làm việc trên nhánh riêng của mình, không tự ý checkout sang nhánh của người kia trừ khi có đồng thuận rõ ràng và review cần thiết.
- Nếu cần chia sẻ hoặc review, có thể push nhánh hiện tại lên remote; nhưng không push trực tiếp lên `main`.

## 6. Quy tắc nghiệm thu

- Trạng thái thực tế luôn được quản lý trong `PLAN.md`.
- `TEAM-RESPONSIBILITIES.md` mô tả ownership, còn `PLAN.md` ghi trạng thái giai đoạn và bằng chứng kiểm thử.
- Không đánh dấu `Done` khi chưa có evidence rõ ràng.
- Mỗi người phải chủ trì cung cấp bằng chứng của module mình; khi đến tích hợp cuối, Sang chủ trì tổng hợp end-to-end còn Thinh cung cấp bằng chứng module của mình.

## 7. Branch & Role Mapping

| Branch name | Default owner | Scope mặc định |
|---|---|---|
| `Sang` | Sang | Database, Auth, RBAC, REST API, Deployment |
| `Thinh` | Thinh | MQTT, Realtime, Frontend |

Nếu current branch không khớp với một trong hai tên nhánh chính trên, AI hoặc người làm phải dừng lại và xác minh lại role trước khi code. Đây chỉ là default context, không phải quyền thay đổi các contract kỹ thuật.

## 8. Kết luận

Phương án phân công này giữ đúng nguyên tắc: mỗi người có owner rõ cho một domain, đồng thời vẫn có review chéo ở các điểm giao tiếp và tích hợp.  
Việc inspection, review và nghiệm thu vẫn dựa trên các tài liệu kỹ thuật của dự án, không phải trên suy đoán cá nhân hoặc dự đoán từ `PLAN.md`.
