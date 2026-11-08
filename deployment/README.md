# Hướng dẫn triển khai hệ thống (Deployment Guide)

Tài liệu hướng dẫn triển khai toàn bộ hệ thống Smart Lighting System bằng Docker Compose dành cho môi trường máy mới (bare machine hoặc server).

## 1. Yêu cầu môi trường

- **Hệ điều hành:** Linux, macOS, hoặc Windows (hỗ trợ WSL2).
- **Phần mềm:** Docker Engine $\ge 24.0$ và Docker Compose $\ge 2.20$.
- **Cổng mạng khả dụng trên Host:**
  - `5432` (PostgreSQL - có thể cấu hình lại qua `POSTGRES_PORT`)
  - `1883` (Mosquitto MQTT Broker - có thể cấu hình lại qua `MQTT_PORT`)
  - `3100` (Backend REST & Realtime API - qua `BACKEND_PORT`)
  - `5173` (Frontend Web UI - qua `FRONTEND_PORT`)

## 2. Các bước triển khai

Từ thư mục gốc của repository:

### Bước 1: Thiết lập cấu hình môi trường (.env)
Sao chép file `.env.example` thành `.env` và điền các giá trị bảo mật:

```powershell
cp .env.example .env
```

Các biến môi trường tối thiểu cần lưu ý:
- `POSTGRES_PASSWORD`: Mật khẩu tài khoản database.
- `SEED_ADMIN_PASSWORD`: Mật khẩu cho tài khoản `admin` khởi tạo tự động.
- `JWT_SECRET`: Chuỗi khóa ký JWT bí mật (dài tối thiểu 32 ký tự).
- `MQTT_BACKEND_PASSWORD`: Mật khẩu kết nối MQTT của Backend.
- `MQTT_LIGHT001_PASSWORD`: Mật khẩu kết nối MQTT của ESP32 vật lý.
- `MQTT_LIGHT002_PASSWORD`: Mật khẩu kết nối MQTT của thiết bị mô phỏng.

### Bước 2: Khởi chạy toàn bộ hệ thống bằng Docker Compose

Chạy lệnh duy nhất từ thư mục gốc repository:

```powershell
docker compose --env-file .env -f deployment/docker-compose.yml up --build -d
```

Compose sẽ tự động:
1. Khởi tạo container **PostgreSQL 18**, tự động chạy schema migration (`001_initial_schema.sql`) và seed dữ liệu vai trò + tài khoản `admin` (`002_roles_and_admin.sql`).
2. Khởi tạo container **Mosquitto 2**, tự động cấu hình `passwordfile` và phân quyền `aclfile` cho từng user (`smart-lighting-backend`, `LIGHT-001`, `LIGHT-002`).
3. Build và khởi chạy container **Backend Node.js/Express**, kết nối vào Postgres & Mosquitto sau khi các dịch vụ phụ thuộc đã sẵn sàng (`healthcheck`).
4. Build và khởi chạy container **Frontend Vite/React** qua Nginx Alpine, phục vụ ứng dụng Web tại cổng `5173`.

### Bước 3: Kiểm tra trạng thái các dịch vụ

```powershell
docker compose --env-file .env -f deployment/docker-compose.yml ps
```

Kỳ vọng cả 4 container đều ở trạng thái `running` hoặc `healthy`:
- `deployment-postgres-1` (healthy)
- `deployment-mosquitto-1` (running)
- `deployment-backend-1` (healthy)
- `deployment-frontend-1` (running)

Kiểm tra health endpoint của Backend:
```powershell
curl http://localhost:3100/health
# Trả về: {"status":"ok","timestamp":"..."}
```

Mở trình duyệt truy cập Web UI: `http://localhost:5173`
- Đăng nhập bằng `admin` và mật khẩu bạn đã đặt ở `SEED_ADMIN_PASSWORD`.

## 3. Dừng và gỡ bỏ hệ thống

```powershell
# Dừng các dịch vụ (giữ lại dữ liệu database và log)
docker compose --env-file .env -f deployment/docker-compose.yml down

# Dừng và xóa toàn bộ dữ liệu volumes
docker compose --env-file .env -f deployment/docker-compose.yml down -v
```
