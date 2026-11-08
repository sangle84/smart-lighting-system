#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <time.h>
#include <vector>

#include <Adafruit_INA219.h>
#include <ArduinoJson.h>
#include <BH1750.h>
#include <PubSubClient.h>

#include "config.h"
#include "mqtt.cpp"

namespace {

// ==========================================
// Data Structures
// ==========================================
struct LuxThreshold {
  float min_lux;
  uint8_t pwm_percent;
};

struct AdaptiveConfig {
  uint32_t config_version = 1;
  bool enabled = true;
  uint32_t motion_timeout_sec = DEFAULT_MOTION_TIMEOUT_SEC;
  std::vector<LuxThreshold> thresholds = {
    {400.0f, 30},
    {200.0f, 50},
    {100.0f, 70},
    {0.0f, 100}
  };
  uint8_t no_motion_pwm_percent = 10;
};

struct DedupEntry {
  char command_id[40];
  char ack_payload[192];
  uint32_t timestamp_ms;
};

// ==========================================
// Global Hardware & Protocol Objects
// ==========================================
BH1750 lightMeter(BH1750_I2C_ADDRESS);
Adafruit_INA219 ina219(INA219_I2C_ADDRESS);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// State Flags
bool bh1750Ready = false;
bool ina219Ready = false;
bool pwmReady = false;

// Sensor Readings
float latestLux = 0.0f;
float latestBusVoltage = 0.0f;
float latestCurrentMilliAmps = 0.0f;
float latestPowerMilliWatts = 0.0f;
bool latestMotion = false;
bool effectiveMotion = false;
bool prevEffectiveMotion = false;
bool hasMotionHistory = false;

// Lighting Control State
uint8_t currentPwmPercent = 0;
uint8_t currentPwmDuty = 0;
uint8_t lastManualPwmPercent = 100;
bool manualOverride = false;
AdaptiveConfig adaptiveConfig;

// Timing Timers
uint32_t lastMotionAt = 0;
uint32_t lastTelemetryAt = 0;
uint32_t lastHeartbeatAt = 0;
uint32_t lastAdaptiveAt = 0;
uint32_t lastMqttReconnectAttempt = 0;

// Topics
char telemetryTopic[64];
char statusTopic[64];
char commandTopic[64];
char ackTopic[64];
char configTopic[64];

// Deduplication Cache (FIFO - 50 items)
constexpr size_t DEDUP_CACHE_SIZE = 50;
DedupEntry dedupCache[DEDUP_CACHE_SIZE];
size_t dedupHead = 0;
size_t dedupCount = 0;

// ==========================================
// Helper Functions
// ==========================================
uint8_t percentToDuty(uint8_t percent) {
  if (percent > 100) percent = 100;
  return static_cast<uint8_t>((percent * 255 + 50) / 100);
}

uint8_t dutyToPercent(uint8_t duty) {
  return static_cast<uint8_t>((duty * 100 + 127) / 255);
}

void applyPwmPercent(uint8_t percent) {
  if (percent > 100) percent = 100;
  currentPwmPercent = percent;
  currentPwmDuty = percentToDuty(percent);
  if (pwmReady) {
    ledcWriteChannel(PWM_CHANNEL, currentPwmDuty);
  }
}

String getIsoTimestamp() {
  time_t now = time(nullptr);
  if (now < 100000) {
    return "1970-01-01T00:00:00Z";
  }
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

time_t parseIsoTimestamp(const char* isoStr) {
  if (!isoStr || strlen(isoStr) < 19) return 0;
  int y, m, d, hr, mn, sc;
  if (sscanf(isoStr, "%d-%d-%dT%d:%d:%d", &y, &m, &d, &hr, &mn, &sc) != 6) {
    return 0;
  }
  struct tm t = {};
  t.tm_year = y - 1900;
  t.tm_mon = m - 1;
  t.tm_mday = d;
  t.tm_hour = hr;
  t.tm_min = mn;
  t.tm_sec = sc;
  return mktime(&t);
}

// ==========================================
// Deduplication Cache Functions
// ==========================================
DedupEntry* findInDedupCache(const char* cmdId) {
  if (!cmdId) return nullptr;
  for (size_t i = 0; i < dedupCount; ++i) {
    if (strncmp(dedupCache[i].command_id, cmdId, sizeof(dedupCache[i].command_id)) == 0) {
      return &dedupCache[i];
    }
  }
  return nullptr;
}

void saveToDedupCache(const char* cmdId, const char* ackJson) {
  if (!cmdId || !ackJson) return;
  DedupEntry* entry = nullptr;
  if (dedupCount < DEDUP_CACHE_SIZE) {
    entry = &dedupCache[dedupCount++];
  } else {
    entry = &dedupCache[dedupHead];
    dedupHead = (dedupHead + 1) % DEDUP_CACHE_SIZE;
  }
  strncpy(entry->command_id, cmdId, sizeof(entry->command_id) - 1);
  entry->command_id[sizeof(entry->command_id) - 1] = '\0';
  strncpy(entry->ack_payload, ackJson, sizeof(entry->ack_payload) - 1);
  entry->ack_payload[sizeof(entry->ack_payload) - 1] = '\0';
  entry->timestamp_ms = millis();
}

// ==========================================
// MQTT Publishing Helpers
// ==========================================
void sendAck(const char* commandId, const char* status, const char* result) {
  JsonDocument doc;
  doc["command_id"] = commandId;
  doc["status"] = status;
  doc["timestamp"] = getIsoTimestamp();
  doc["result"] = result;

  char payload[192];
  serializeJson(doc, payload, sizeof(payload));

  saveToDedupCache(commandId, payload);
  mqttClient.publish(ackTopic, payload, false);
  Serial.printf("[MQTT] Published ACK: %s\n", payload);
}

void publishStatus(const char* statusStr, bool retain = false) {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["status"] = statusStr;
  doc["uptime_seconds"] = millis() / 1000;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["timestamp"] = getIsoTimestamp();

  char payload[256];
  serializeJson(doc, payload, sizeof(payload));
  mqttClient.publish(statusTopic, payload, retain);
  Serial.printf("[MQTT] Status: %s\n", payload);
}

void publishTelemetry() {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = getIsoTimestamp();
  doc["lux"] = round(latestLux * 10.0f) / 10.0f;
  doc["motion"] = latestMotion;
  doc["voltage"] = round(latestBusVoltage * 10.0f) / 10.0f;
  doc["current"] = round((latestCurrentMilliAmps / 1000.0f) * 100.0f) / 100.0f;
  doc["power"] = round((latestPowerMilliWatts / 1000.0f) * 100.0f) / 100.0f;
  doc["pwm"] = currentPwmPercent;

  char payload[256];
  serializeJson(doc, payload, sizeof(payload));
  mqttClient.publish(telemetryTopic, payload, false);
  Serial.printf("[MQTT] Telemetry: %s\n", payload);
}

// ==========================================
// Command and Config Message Callbacks
// ==========================================
void handleCommand(const JsonDocument& doc) {
  const char* cmdId = doc["command_id"];
  const char* cmdType = doc["command_type"];
  const char* timestampStr = doc["timestamp"];

  if (!cmdId || !cmdType) {
    Serial.println("[COMMAND] Invalid format (missing id or type)");
    return;
  }

  // 1. Deduplication check
  DedupEntry* cached = findInDedupCache(cmdId);
  if (cached) {
    Serial.printf("[COMMAND] Duplicate command %s, re-sending cached ACK\n", cmdId);
    mqttClient.publish(ackTopic, cached->ack_payload, false);
    return;
  }

  // 2. Check message expiration (60s) per API_SPEC B.6
  if (timestampStr) {
    time_t cmdTime = parseIsoTimestamp(timestampStr);
    time_t nowTime = time(nullptr);
    if (cmdTime > 100000 && nowTime > 100000) {
      if (nowTime > cmdTime && (nowTime - cmdTime) > MESSAGE_EXPIRY_SECONDS) {
        Serial.printf("[COMMAND] Expired command %s (delta: %ld s)\n", cmdId, (long)(nowTime - cmdTime));
        sendAck(cmdId, "REJECTED", "COMMAND_EXPIRED");
        return;
      }
    }
  }

  // 3. Execute command
  if (strcmp(cmdType, "PWM") == 0) {
    if (!doc["command_value"].is<int>()) {
      sendAck(cmdId, "REJECTED", "INVALID_COMMAND_VALUE");
      return;
    }
    int val = doc["command_value"].as<int>();
    if (val < 0 || val > 100) {
      sendAck(cmdId, "REJECTED", "INVALID_COMMAND_VALUE");
      return;
    }

    applyPwmPercent(static_cast<uint8_t>(val));
    if (val > 0) {
      lastManualPwmPercent = static_cast<uint8_t>(val);
    }
    manualOverride = true;
    sendAck(cmdId, "ACKNOWLEDGED", "PWM_SET");
    Serial.printf("[COMMAND] PWM set to %d%% (manual override ON)\n", val);

  } else if (strcmp(cmdType, "OFF") == 0) {
    applyPwmPercent(0);
    manualOverride = true;
    sendAck(cmdId, "ACKNOWLEDGED", "TURNED_OFF");
    Serial.println("[COMMAND] Light turned OFF (manual override ON)");

  } else if (strcmp(cmdType, "ON") == 0) {
    uint8_t target = lastManualPwmPercent > 0 ? lastManualPwmPercent : 100;
    applyPwmPercent(target);
    manualOverride = true;
    sendAck(cmdId, "ACKNOWLEDGED", "TURNED_ON");
    Serial.printf("[COMMAND] Light turned ON to %d%% (manual override ON)\n", target);

  } else {
    sendAck(cmdId, "REJECTED", "UNKNOWN_COMMAND_TYPE");
  }
}

void handleConfig(const JsonDocument& doc) {
  if (doc["config_version"].is<uint32_t>()) {
    adaptiveConfig.config_version = doc["config_version"].as<uint32_t>();
  }
  if (doc["enabled"].is<bool>()) {
    adaptiveConfig.enabled = doc["enabled"].as<bool>();
  }
  if (doc["motion_timeout_sec"].is<uint32_t>()) {
    adaptiveConfig.motion_timeout_sec = doc["motion_timeout_sec"].as<uint32_t>();
  }
  if (doc["no_motion_pwm"].is<uint8_t>()) {
    adaptiveConfig.no_motion_pwm_percent = doc["no_motion_pwm"].as<uint8_t>();
  }

  JsonArrayConst thresholds = doc["lux_thresholds"].as<JsonArrayConst>();
  if (!thresholds.isNull() && thresholds.size() > 0) {
    adaptiveConfig.thresholds.clear();
    for (JsonObjectConst t : thresholds) {
      LuxThreshold th;
      th.min_lux = t["min_lux"].as<float>();
      th.pwm_percent = t["pwm"].as<uint8_t>();
      adaptiveConfig.thresholds.push_back(th);
    }
  }

  Serial.printf("[CONFIG] Updated: enabled=%s, motion_timeout=%lu s, no_motion_pwm=%u%%\n",
                adaptiveConfig.enabled ? "true" : "false",
                (unsigned long)adaptiveConfig.motion_timeout_sec,
                adaptiveConfig.no_motion_pwm_percent);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[MQTT] JSON parse error on %s: %s\n", topic, err.c_str());
    return;
  }

  if (strcmp(topic, commandTopic) == 0) {
    handleCommand(doc);
  } else if (strcmp(topic, configTopic) == 0) {
    handleConfig(doc);
  }
}

// ==========================================
// Adaptive Lighting Logic
// ==========================================
uint8_t calculateAdaptiveDuty(float lux, bool motion) {
  if (!motion) {
    return percentToDuty(adaptiveConfig.no_motion_pwm_percent);
  }

  // Sorted or linear scan matching thresholds
  for (const auto& th : adaptiveConfig.thresholds) {
    if (lux >= th.min_lux) {
      return percentToDuty(th.pwm_percent);
    }
  }
  return 255;
}

void updateSensorsAndAdaptive(uint32_t now) {
  latestMotion = digitalRead(MOTION_PIN) == HIGH;
  if (latestMotion) {
    lastMotionAt = now;
    hasMotionHistory = true;
  }

  const uint32_t motionTimeoutMs = adaptiveConfig.motion_timeout_sec * 1000;
  effectiveMotion = hasMotionHistory && (now - lastMotionAt <= motionTimeoutMs);

  // Manual override reset condition (ARCHITECTURE 7.2):
  // When effective motion state changes (true <-> false), manual override is released!
  if (effectiveMotion != prevEffectiveMotion) {
    if (manualOverride) {
      Serial.println("[ADAPTIVE] Effective motion changed -> releasing manual override");
      manualOverride = false;
    }
    prevEffectiveMotion = effectiveMotion;
  }

  if (bh1750Ready) {
    latestLux = lightMeter.readLightLevel();
  }
  if (ina219Ready) {
    latestBusVoltage = ina219.getBusVoltage_V();
    latestCurrentMilliAmps = ina219.getCurrent_mA();
    latestPowerMilliWatts = ina219.getPower_mW();
  }

  // Evaluate Adaptive Lighting
  if (now - lastAdaptiveAt >= ADAPTIVE_INTERVAL_MS) {
    lastAdaptiveAt = now;

    if (!manualOverride && adaptiveConfig.enabled && pwmReady) {
      uint8_t targetDuty = calculateAdaptiveDuty(latestLux, effectiveMotion);
      if (targetDuty != currentPwmDuty) {
        currentPwmDuty = targetDuty;
        currentPwmPercent = dutyToPercent(currentPwmDuty);
        ledcWriteChannel(PWM_CHANNEL, currentPwmDuty);
        Serial.printf("[ADAPTIVE] Adjusted PWM to %u%% (duty %u)\n", currentPwmPercent, currentPwmDuty);
      }
    }
  }
}

// ==========================================
// Network & Connection Management
// ==========================================
void setupWiFi() {
  Serial.printf("[WIFI] Connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  uint32_t now = millis();
  if (now - lastMqttReconnectAttempt < RECONNECT_RETRY_INTERVAL_MS) {
    return;
  }
  lastMqttReconnectAttempt = now;

  Serial.printf("[MQTT] Connecting to broker %s:%d as %s...\n",
                MQTT_BROKER_HOST, MQTT_BROKER_PORT, DEVICE_ID);

  // LWT payload (retained, QoS 1 per spec B.6)
  char lwtPayload[128];
  snprintf(lwtPayload, sizeof(lwtPayload),
           "{\"device_id\":\"%s\",\"status\":\"OFFLINE\",\"timestamp\":\"%s\"}",
           DEVICE_ID, getIsoTimestamp().c_str());

  if (mqttClient.connect(DEVICE_ID, DEVICE_ID, MQTT_DEVICE_PASSWORD,
                         statusTopic, 1, true, lwtPayload)) {
    Serial.println("[MQTT] Connected successfully!");

    // Publish ONLINE status on connect (retain = true, QoS 1)
    publishStatus("ONLINE", true);

    // Subscribe to command and config topics
    mqttClient.subscribe(commandTopic, 1);
    mqttClient.subscribe(configTopic, 1);
    Serial.printf("[MQTT] Subscribed to %s and %s\n", commandTopic, configTopic);
  } else {
    Serial.printf("[MQTT] Connection failed, rc=%d. Will retry in 5s\n", mqttClient.state());
  }
}

void setupTopics() {
  snprintf(telemetryTopic, sizeof(telemetryTopic), "iot/device/%s/telemetry", DEVICE_ID);
  snprintf(statusTopic, sizeof(statusTopic), "iot/device/%s/status", DEVICE_ID);
  snprintf(commandTopic, sizeof(commandTopic), "iot/device/%s/command", DEVICE_ID);
  snprintf(ackTopic, sizeof(ackTopic), "iot/device/%s/ack", DEVICE_ID);
  snprintf(configTopic, sizeof(configTopic), "iot/device/%s/config", DEVICE_ID);
}

void setupSensorsAndHardware() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  pinMode(MOTION_PIN, INPUT);
  pinMode(ONBOARD_LED_PIN, OUTPUT);

  bh1750Ready = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!bh1750Ready) {
    Serial.println("[WARN] BH1750 initialization failed at 0x23");
  } else {
    Serial.println("[OK] BH1750 initialized");
  }

  ina219Ready = ina219.begin();
  if (!ina219Ready) {
    Serial.println("[WARN] INA219 initialization failed at 0x40");
  } else {
    Serial.println("[OK] INA219 initialized");
  }

  pwmReady = ledcAttachChannel(PWM_PIN, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS, PWM_CHANNEL);
  if (!pwmReady) {
    Serial.println("[ERROR] PWM initialization failed on GPIO 18");
  } else {
    ledcWriteChannel(PWM_CHANNEL, 0);
    Serial.println("[OK] PWM initialized on GPIO 18");
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=============================================");
  Serial.printf("  Smart Lighting System - ESP32 (%s)\n", DEVICE_ID);
  Serial.printf("  Firmware Version: %s\n", FIRMWARE_VERSION);
  Serial.println("=============================================");

  setupTopics();
  setupSensorsAndHardware();

  // Time Sync via SNTP
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  // Wi-Fi & MQTT
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);
}

void loop() {
  uint32_t now = millis();

  // Wi-Fi connection monitoring
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      connectMqtt();
    } else {
      mqttClient.loop();
    }
  }

  // Sensor reading and adaptive lighting calculation
  updateSensorsAndAdaptive(now);

  // Periodic Telemetry publish
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    if (mqttClient.connected()) {
      publishTelemetry();
    }
  }

  // Periodic Heartbeat publish
  if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatAt = now;
    if (mqttClient.connected()) {
      publishStatus("ONLINE", false);
    }
  }
}
