# ESP32 Hardware Test Firmware

Đây là project PlatformIO dùng để kiểm tra phần cứng ESP32 và cảm biến. Đây chưa phải firmware chính: chưa có WiFi, MQTT hoặc Adaptive Lighting.

## Chạy test

Từ thư mục `firmware/`:

```text
pio run -e blink -t upload
pio device monitor
```

Thay `blink` bằng environment cần chạy: `i2cscan`, `sensors` hoặc `pwmtest`.

| Environment | Kết quả mong đợi |
|---|---|
| `blink` | Serial in `ESP32 OK`, sau đó `LED ON`/`LED OFF`; LED onboard GPIO2 đổi trạng thái mỗi 500 ms. |
| `i2cscan` | In các địa chỉ I2C tìm thấy; kỳ vọng `0x23` (BH1750) và `0x40` (INA219), đồng thời cảnh báo nếu thiếu. |
| `sensors` | Mỗi giây in lux, motion GPIO19, bus voltage, current và power từ INA219. Khi INA219 chưa nối Vin+/Vin-, dòng và công suất gần 0 là bình thường. |
| `pwmtest` | Ramp duty GPIO18 từ 0% lên 100% rồi về 0%. **Không chạy cho tới khi đã xác nhận dây MOSFET.** |

Chỉ chạy `pio run -e <env>` để build khi chưa kết nối board; không upload trong môi trường không có ESP32.