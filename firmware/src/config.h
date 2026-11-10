#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ==========================================
// Wi-Fi Configuration
// ==========================================
#ifndef WIFI_SSID
#define WIFI_SSID "SANG LE"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "88888888"
#endif

// ==========================================
// MQTT Broker Configuration
// ==========================================
#ifndef MQTT_BROKER_HOST
#define MQTT_BROKER_HOST "172.24.208.1"  // IP LAN hiện tại của máy chạy Mosquitto
#endif

#ifndef MQTT_BROKER_PORT
#define MQTT_BROKER_PORT 1883
#endif

#ifndef DEVICE_ID
#define DEVICE_ID "LIGHT-001"
#endif

#ifndef MQTT_DEVICE_PASSWORD
#define MQTT_DEVICE_PASSWORD "light001-secret-pass"
#endif

#define FIRMWARE_VERSION "1.0.0"

// ==========================================
// Hardware Pinout Definitions
// ==========================================
constexpr uint8_t ONBOARD_LED_PIN = 2;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t MOTION_PIN = 19;
constexpr uint8_t PWM_PIN = 18;
constexpr uint8_t PWM_CHANNEL = 0;

// I2C Addresses
constexpr uint8_t BH1750_I2C_ADDRESS = 0x23;
constexpr uint8_t INA219_I2C_ADDRESS = 0x40;

// PWM Configuration (5 kHz, 8-bit: 0-255)
constexpr uint32_t PWM_FREQUENCY_HZ = 5000;
constexpr uint8_t PWM_RESOLUTION_BITS = 8;

// Timing Constants (milliseconds)
constexpr uint32_t DEFAULT_MOTION_TIMEOUT_SEC = 30; // 30s per ARCHITECTURE 7.1
constexpr uint32_t TELEMETRY_INTERVAL_MS = 5000;    // 5s per API_SPEC B.6
constexpr uint32_t HEARTBEAT_INTERVAL_MS = 10000;   // 10s per API_SPEC B.6
constexpr uint32_t ADAPTIVE_INTERVAL_MS = 1000;     // 1s per ARCHITECTURE 7.1
constexpr uint32_t RECONNECT_RETRY_INTERVAL_MS = 5000;
constexpr uint32_t MESSAGE_EXPIRY_SECONDS = 60;     // 60s per API_SPEC B.6

#endif // CONFIG_H
