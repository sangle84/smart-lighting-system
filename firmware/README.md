# ESP32 Firmware — Smart Lighting System

Firmware viết bằng C++ trên PlatformIO (Arduino Framework) dành cho node đèn thông minh ESP32 (`LIGHT-001`).

## 1. Tính năng của Firmware chính (`env:main`)

- **Cảm biến:** Đọc cường độ ánh sáng từ BH1750 (I2C `0x23`), chuyển động từ RCWL-0516 (GPIO 19), điện áp/dòng điện/công suất từ INA219 (I2C `0x40`).
- **Điều khiển PWM:** Điều khiển MOSFET qua kênh LEDC (GPIO 18, 5 kHz, 8-bit resolution, tương ứng dải 0–100%).
- **Adaptive Lighting:** Tự động điều chỉnh độ sáng dựa theo ánh sáng môi trường và trạng thái chuyển động hiệu dụng (`effective motion` với timeout 30s).
- **Manual Override:** Khi nhận lệnh thủ công (`PWM`, `ON`, `OFF`), kích hoạt ghi đè cho tới khi trạng thái có người hiệu dụng thay đổi (`true` $\leftrightarrow$ `false`).
- **Giao tiếp MQTT (v3.1.1):**
  - Tự động kết nối và reconnect Wi-Fi & Mosquitto broker.
  - Đồng bộ giờ UTC qua SNTP (`pool.ntp.org`).
  - Kiểm tra hết hạn lệnh 60 giây ở tầng ứng dụng (Application Layer Message Expiry).
  - Khử trùng lặp lệnh (Deduplication cache 50 mục) đảm bảo tính idempotent.
  - Bản tin LWT báo `OFFLINE` (retain: true, QoS 1).
  - Heartbeat định kỳ 10s lên `iot/device/{id}/status`.
  - Telemetry định kỳ 5s lên `iot/device/{id}/telemetry`.
  - Nhận lệnh điều khiển từ `iot/device/{id}/command` và gửi ACK về `iot/device/{id}/ack`.
  - Nhận cấu hình ngưỡng thích ứng từ `iot/device/{id}/config`.

## 2. Cấu hình thông số kết nối

Mở file [`src/config.h`](src/config.h) và cập nhật thông tin mạng:
- `WIFI_SSID`: Tên Wi-Fi (ví dụ Wi-Fi nhà bạn hoặc hotspot điện thoại).
- `WIFI_PASSWORD`: Mật khẩu Wi-Fi.
- `MQTT_BROKER_HOST`: Địa chỉ IP máy tính chạy Mosquitto (ví dụ `192.168.1.15`).
- `MQTT_BROKER_PORT`: Cổng MQTT (mặc định `1883`).
- `MQTT_DEVICE_PASSWORD`: Mật khẩu thiết bị `LIGHT-001` (khớp với `MQTT_LIGHT001_PASSWORD` trong `.env`).

## 3. Biên dịch và nạp Firmware

Từ thư mục `firmware/`:

```powershell
# 1. Biên dịch kiểm tra
pio run -e main

# 2. Cắm cáp ESP32 vào cổng USB máy tính và nạp firmware
pio run -e main -t upload

# 3. Mở Serial Monitor theo dõi log
pio device monitor
```

## 4. Các môi trường kiểm tra phần cứng (Hardware Test Environments)

| Môi trường | Lệnh chạy | Mô tả |
|---|---|---|
| `blink` | `pio run -e blink -t upload` | Chớp tắt LED onboard GPIO 2 (kiểm tra chip ESP32 sống). |
| `i2cscan` | `pio run -e i2cscan -t upload` | Quét địa chỉ I2C (kỳ vọng `0x23` cho BH1750 và `0x40` cho INA219). |
| `sensors` | `pio run -e sensors -t upload` | In số đo cảm biến liên tục ra Serial Monitor mà không cần Wi-Fi/MQTT. |
| `pwmtest` | `pio run -e pwmtest -t upload` | Ramp PWM từ 0% lên 100% để kiểm tra mạch MOSFET và LED 12V. |
