# AGENTS.md

> Entry point dành cho AI coding agent (ví dụ: agent chạy trong VS Code).
> Đọc file này **trước tiên** trước khi thực hiện bất kỳ thay đổi code nào trong repository.

## 1. Project Overview

- **Tên project:** Smart Lighting System
- **Tên GitHub repository:** `smart-lighting-system`
- **Loại hệ thống:** Hệ thống IoT chiếu sáng thông minh, giám sát và điều khiển qua MQTT.
- **Mục tiêu:** Thu thập dữ liệu cảm biến (ánh sáng, chuyển động, điện năng) từ thiết bị ESP32, cho phép điều khiển đèn LED từ xa qua Web, tự động điều chỉnh độ sáng (Adaptive Lighting), và phát cảnh báo khi thiết bị hoạt động bất thường hoặc mất kết nối.
- **Các thành phần chính:**
  - Firmware ESP32 (cảm biến + điều khiển PWM + MQTT client)
  - MQTT Broker (Mosquitto)
  - Backend (Node.js + Express + TypeScript)
  - Database (PostgreSQL)
  - Frontend (React + TypeScript + Vite + Tailwind CSS)
  - Realtime layer (Socket.IO)

Đây là một **đồ án/prototype học phần IoT** (nhóm 2 thành viên), không phải sản phẩm thương mại hoàn chỉnh. Các thông số kỹ thuật, hợp đồng API/MQTT, ngưỡng cảnh báo và cấu trúc CSDL đã được **[ĐÃ BỔ SUNG]** chuẩn hóa đầy đủ trong toàn bộ các file tài liệu để làm căn cứ triển khai mã nguồn.

## 2. Repository Structure

Cấu trúc repository lấy theo báo cáo gốc (mục 4.1.1) và khớp danh sách thư mục bắt buộc trong đề bài (mục 8.1):

```text
smart-lighting-system/
├── firmware/       # ESP32: src/{sensors, actuators, mqtt, config}, platformio.ini
├── backend/        # Express + TS: src/{controllers, services, repositories, mqtt, realtime, routes}
├── frontend/       # React + Vite: src/{components, pages, hooks, services, context}
├── database/       # migrations, seeds, schema.sql
├── deployment/     # docker-compose.yml, Dockerfile, cấu hình Mosquitto, hướng dẫn triển khai
├── hardware/       # BOM, pinout wiring diagram, ảnh prototype
├── tests/          # e2e, integration, mqtt-simulator
├── docs/           # PRD, ARCHITECTURE, API_SPEC, DATABASE, PROJECT-RULES; báo cáo, slide
├── AGENTS.md       # Entry point cho AI agent
├── PLAN.md         # Tiến độ triển khai + evidence; không phải source of truth kỹ thuật
├── README.md       # Giới thiệu, kiến trúc, hướng dẫn cài đặt và chạy
└── .env.example    # Danh sách biến môi trường, không chứa bí mật thật
```

> **[ĐÃ BỔ SUNG]** Cấu trúc con bên trong các module chính (`backend/`, `frontend/`, `firmware/`) đã được định hình chi tiết theo kiến trúc Modular Monolith để phân tách rõ trách nhiệm giữa các layer.

> **[ĐÃ BỔ SUNG]** `AGENTS.md` (file này) và `PLAN.md` nằm ở **gốc repository**, ngang hàng `README.md` — không nằm trong `docs/`. `docs/` chứa các tài liệu contract kỹ thuật (PRD, ARCHITECTURE, API_SPEC, DATABASE, PROJECT-RULES) cùng báo cáo, slide và các tài liệu thiết kế khác theo yêu cầu đề bài.

> **[ĐÃ BỔ SUNG]** Docker Compose đặt **một chỗ duy nhất**: `deployment/docker-compose.yml` (không có `docker-compose.yml` ở gốc repo). Docker Compose lấy thư mục của file compose làm project directory nên không tự đọc `.env` ở gốc; lệnh chạy chuẩn từ gốc repo là `docker compose --env-file .env -f deployment/docker-compose.yml up`. Agent không tạo thêm file compose trùng ở nơi khác.

## 3. Documentation Map

| File | Nội dung |
|---|---|
| `docs/PRD.md` | Requirements và chức năng (WHAT/WHY) |
| `docs/ARCHITECTURE.md` | Kiến trúc và các thành phần hệ thống (HOW ở mức tổ chức) |
| `docs/API_SPEC.md` | REST API và MQTT contract (communication contract) |
| `docs/DATABASE.md` | Database schema và relationships |
| `docs/UI.md` | Hướng dẫn giao diện, màu chủ đề và design tokens |
| `docs/PROJECT-RULES.md` | Quy tắc phát triển dành cho agent khi sửa code |
| `docs/TEAM-RESPONSIBILITIES.md` | Phân công hai thành viên, ownership theo module, branch mapping và quy tắc bàn giao |
| `docs/WORKFLOW-CHECKLIST.md` | Checklist bắt đầu task, tạo branch, pull code mới và workflow chuẩn cho nhóm |
| `PLAN.md` | Tiến độ theo giai đoạn và bằng chứng hoàn thành; không chứa contract kỹ thuật |

Agent nên đọc file tương ứng với loại task **trước khi** viết hoặc sửa code, không suy đoán từ trí nhớ.  
Nếu đang làm dự án theo nhóm, agent phải đồng thời đọc `docs/TEAM-RESPONSIBILITIES.md` và `docs/WORKFLOW-CHECKLIST.md` để xác định owner, nhánh hoạt động hiện tại và quy trình bắt đầu task trước khi sửa code.

## 4. Agent Workflow

Khi nhận một task, agent thực hiện theo thứ tự:

1. Đọc `AGENTS.md` (file này).
2. Xác định loại task (feature backend? sửa firmware? đổi API? thêm bảng DB? sửa UI?).
3. Đọc `docs/TEAM-RESPONSIBILITIES.md` để xác định owner mặc định theo nhánh hiện tại và phạm vi của người làm.
4. Đọc tài liệu liên quan trong `docs/` tương ứng với loại task đó.
5. Kiểm tra branch hiện tại trước khi chỉnh code: nếu đang ở `main` hoặc branch không có prefix hợp lệ (`Sang/` hoặc `Thinh/`), **tạo nhánh mới trước khi sửa**; không code thẳng lên `main`.
6. Trước khi bắt đầu task, **pull hoặc fetch/rebase code mới nhất** của branch hiện tại để tránh làm việc trên snapshot cũ và xung đột không cần thiết.
7. Kiểm tra code hiện tại trong repo (không giả định code đã tồn tại hay đã hoạt động đúng).
8. **Không tự ý** thay đổi architecture, API contract, MQTT contract hoặc database schema nếu không được yêu cầu rõ ràng.
9. Thực hiện thay đổi tối thiểu cần thiết để hoàn thành task.
9. Kiểm tra/test phần bị ảnh hưởng sau khi thay đổi (xem `docs/PROJECT-RULES.md` mục Testing Rules).
10. Nếu thay đổi làm ảnh hưởng đến API, database hoặc architecture, **cập nhật tài liệu tương ứng** trong cùng lần thay đổi.
11. Nếu thay đổi trạng thái triển khai, cập nhật `PLAN.md` **chỉ khi có bằng chứng cụ thể**; không đánh dấu `Done` chỉ vì đã yêu cầu agent thực hiện hoặc vì agent tự báo cáo đã xong.
12. Sau khi hoàn thành và đã kiểm tra, **tự commit local** theo `docs/PROJECT-RULES.md` mục 9 (mục "Agent tự động commit"): một thay đổi logic một commit, chỉ add file cụ thể, không commit secret. Nếu cần chia sẻ hoặc review, có thể `git push` lên remote theo nhánh hiện tại (`Sang` hoặc `Thinh`) nhưng **không push trực tiếp lên `main`**; không tạo tag, không sửa lịch sử Git; báo lại cho người dùng hash và nội dung commit để họ tự push.

## 5. Source of Truth

Khi có mâu thuẫn thông tin, agent ưu tiên theo thứ tự sau:

1. **Explicit user instruction** — chỉ dẫn trực tiếp từ người dùng trong phiên làm việc hiện tại.
2. **Existing project implementation** — code hiện có trong repository.
3. **Approved project documentation** — các file trong `docs/` và `AGENTS.md`.
4. **Original project report** — báo cáo đồ án gốc (nguồn dữ liệu ban đầu để tạo ra các file docs này).
5. **Assumption** — chỉ dùng khi không có gì ở 4 mức trên, và phải nêu rõ đây là giả định.

**Nguyên tắc quan trọng:** nếu một thông tin chưa được xác định ở bất kỳ mức nào, agent **không được** tự ý biến assumption thành requirement chính thức. Phải hỏi lại người dùng hoặc đánh dấu `TODO` trong code/tài liệu.

### 5.1 Vai trò của PLAN.md

`PLAN.md` **không phải source of truth cho technical contract hoặc trạng thái implementation**. Nó chỉ dùng để theo dõi tiến độ theo giai đoạn, đứng dưới cả "Existing project implementation" lẫn "Approved project documentation" ở trên. Nếu `PLAN.md` ghi một giai đoạn là `Done` nhưng code thực tế hoặc `docs/` cho thấy khác, **không dùng `PLAN.md` để override** — phải kiểm tra lại code/docs và coi đó là nguồn đáng tin hơn.

## 6. Important Constraints

- Agent được tự commit local nhưng **không bao giờ tự push** hoặc tạo tag/release (xem `docs/PROJECT-RULES.md` mục 9).
- Mọi thay đổi code phải bắt đầu từ đúng nhánh của owner. Chỉ dùng 2 nhánh chính: `Sang` và `Thinh`. Không được code trực tiếp lên `main`.
- Nếu branch hiện tại không khớp với owner đang làm hoặc đang ở `main`, agent phải tạo nhánh mới trước khi chỉnh file. Đây là quy tắc bắt buộc để tránh xung đột và đảm bảo trách nhiệm cá nhân rõ ràng.
- Trước khi bắt đầu task, agent phải pull/fetch code mới nhất của branch hiện tại hoặc rebase nếu đang có thay đổi cũ; không làm việc trên snapshot quá cũ so với repo.
- Không tạo nhánh con dưới dạng `Sang/<task-name>` hoặc `Thinh/<task-name>`; chỉ dùng 2 nhánh chính `Sang` và `Thinh`.
- Đây là **prototype phạm vi hẹp**: 1 node ESP32 vật lý (`LIGHT-001`), cộng thiết bị mô phỏng (`LIGHT-002`, trong `tests/mqtt-simulator`) chỉ để kiểm thử phân quyền/thu hồi/mở rộng; thiết bị mô phỏng không thay thế thiết bị vật lý.
- Công nghệ đã được lựa chọn cố định (xem `docs/ARCHITECTURE.md`), agent **không tự ý thay thế** (ví dụ không đổi PostgreSQL sang MongoDB, không đổi MQTT sang HTTP polling).
- Hệ thống dùng **RBAC ba vai trò**: Admin, Operator, Viewer. Mọi thay đổi liên quan đến quyền phải tuân thủ đúng ma trận quyền trong `docs/PRD.md` và phạm vi truy cập theo thiết bị (`DEVICE_ACCESS`, xem `docs/API_SPEC.md`).
- Giao tiếp thiết bị dùng **MQTT** qua Mosquitto, theo cấu trúc topic cố định trong `docs/API_SPEC.md`.
- Thiết bị vật lý là **ESP32** với các cảm biến/cơ cấu chấp hành cố định (BH1750, RCWL-0516, INA219, IRLZ44N, LED 12V).
- Database là **PostgreSQL**, đúng 8 entity đã định nghĩa trong `docs/DATABASE.md` (gồm `DEVICE_ACCESS`). Không tự thêm bảng.
- **Không tự ý mở rộng phạm vi**: các hạng mục sau nằm ngoài phạm vi hiện tại và **không được thêm vào** trừ khi có chỉ dẫn rõ ràng: AI/ML, OTA firmware, RGB lighting, báo cháy, báo trộm, camera, mobile app riêng.
- Nhiều nội dung trong báo cáo gốc còn để trống hoặc đánh dấu "bổ sung sau" (kết quả kiểm thử, số liệu độ trễ, đường dẫn GitHub, chi tiết triển khai thực tế). Các phần này được giữ nguyên là `TODO/UNDEFINED` trong toàn bộ tài liệu — agent không được tự bịa số liệu hoặc kết quả.
