# ESP32 Hardware Test Pinout

Giai đoạn này chạy bằng nguồn USB của ESP32 để kiểm tra board và tín hiệu cảm biến. Chưa cấp nguồn 12V và chưa sử dụng buck Mini 560 Pro.

| Thiết bị | Chân thiết bị | Kết nối |
|---|---|---|
| BH1750 | VCC | ESP32 3V3 |
| BH1750 | GND | ESP32 GND |
| BH1750 | SDA | ESP32 GPIO21 |
| BH1750 | SCL | ESP32 GPIO22 |
| BH1750 | ADDR | GND, địa chỉ I2C `0x23` |
| INA219 | VCC | ESP32 3V3 |
| INA219 | GND | ESP32 GND |
| INA219 | SDA | ESP32 GPIO21, chung bus I2C |
| INA219 | SCL | ESP32 GPIO22, chung bus I2C |
| INA219 | Vin+, Vin- | Chưa nối trong giai đoạn test phần cứng này |
| RCWL-0516 | VIN | 5V từ nguồn phù hợp của mạch test |
| RCWL-0516 | GND | ESP32 GND |
| RCWL-0516 | OUT | ESP32 GPIO19 |
| IRLZ44N | Gate | ESP32 GPIO18 qua điện trở 220 ohm; pull-down 10 kohm xuống GND |
| IRLZ44N | Drain, Source | Chưa nối trong giai đoạn test này |
| LED strip 2835 12V | (+), (-) | Chưa nối trong giai đoạn test này |

## Lưu ý an toàn

- Không cấp 12V trong giai đoạn test USB này.
- Không dùng buck Mini 560 Pro trong giai đoạn test này.
- Không chạy environment `pwmtest` cho tới khi đã kiểm tra và xác nhận toàn bộ dây MOSFET, điện trở gate/pull-down, mass chung và tải.