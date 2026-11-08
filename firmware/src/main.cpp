#include <Arduino.h>
#include <Wire.h>

#include <Adafruit_INA219.h>
#include <BH1750.h>

namespace {
constexpr uint8_t ONBOARD_LED_PIN = 2;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t MOTION_PIN = 19;
constexpr uint8_t PWM_PIN = 18;
constexpr uint8_t PWM_CHANNEL = 0;

constexpr uint8_t BH1750_I2C_ADDRESS = 0x23;
constexpr uint8_t INA219_I2C_ADDRESS = 0x40;
constexpr uint32_t PWM_FREQUENCY_HZ = 5000;
constexpr uint8_t PWM_RESOLUTION_BITS = 8;
constexpr uint32_t TELEMETRY_INTERVAL_MS = 1000;
constexpr uint32_t ADAPTIVE_INTERVAL_MS = 1000;
constexpr uint32_t MOTION_TIMEOUT_MS = 30000;

BH1750 lightMeter(BH1750_I2C_ADDRESS);
Adafruit_INA219 ina219(INA219_I2C_ADDRESS);

bool bh1750Ready = false;
bool ina219Ready = false;
bool pwmReady = false;
float latestLux = 0.0F;
float latestBusVoltage = 0.0F;
float latestCurrentMilliAmps = 0.0F;
float latestPowerMilliWatts = 0.0F;
bool latestMotion = false;
bool effectiveMotion = false;
bool hasMotionHistory = false;
uint8_t currentPwmDuty = 0;
uint32_t lastMotionAt = 0;
uint32_t lastTelemetryAt = 0;
uint32_t lastAdaptiveAt = 0;

void setupSerial() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
}

void setupI2C() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
}

void setupSensorsAndPwm() {
  setupI2C();
  pinMode(MOTION_PIN, INPUT);

  bh1750Ready = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!bh1750Ready) {
    Serial.println("ERROR: BH1750 initialization failed at 0x23");
  }

  ina219Ready = ina219.begin();
  if (!ina219Ready) {
    Serial.println("ERROR: INA219 initialization failed at 0x40");
  }

  pwmReady = ledcAttachChannel(PWM_PIN, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS, PWM_CHANNEL);
  if (!pwmReady) {
    Serial.println("ERROR: PWM initialization failed on GPIO18");
  } else {
    ledcWriteChannel(PWM_CHANNEL, currentPwmDuty);
  }
}

uint8_t adaptiveDutyFromLux(const float lux) {
  if (lux > 400.0F) {
    return 77;
  }
  if (lux >= 200.0F) {
    return 128;
  }
  if (lux >= 100.0F) {
    return 179;
  }
  return 255;
}

void readSensors(const uint32_t now) {
  latestMotion = digitalRead(MOTION_PIN) == HIGH;
  if (latestMotion) {
    lastMotionAt = now;
    hasMotionHistory = true;
  }
  effectiveMotion = hasMotionHistory && now - lastMotionAt <= MOTION_TIMEOUT_MS;

  if (bh1750Ready) {
    latestLux = lightMeter.readLightLevel();
  }
  if (ina219Ready) {
    latestBusVoltage = ina219.getBusVoltage_V();
    latestCurrentMilliAmps = ina219.getCurrent_mA();
    latestPowerMilliWatts = ina219.getPower_mW();
  }
}

void applyAdaptiveLighting(const uint32_t now) {
  if (!pwmReady || !bh1750Ready || now - lastAdaptiveAt < ADAPTIVE_INTERVAL_MS) {
    return;
  }
  lastAdaptiveAt = now;

  const uint8_t targetDuty = effectiveMotion ? adaptiveDutyFromLux(latestLux) : 0;
  if (targetDuty != currentPwmDuty) {
    currentPwmDuty = targetDuty;
    ledcWriteChannel(PWM_CHANNEL, currentPwmDuty);
  }
}

void printTelemetry() {

  Serial.print("[TELEMETRY] Lux: ");
  if (bh1750Ready) {
    Serial.printf("%.2f lx", latestLux);
  } else {
    Serial.print("ERROR");
  }

  Serial.print(" | Bus: ");
  if (ina219Ready) {
    Serial.printf("%.2f V | Current: %.1f mA | Power: %.1f mW",
                  latestBusVoltage, latestCurrentMilliAmps, latestPowerMilliWatts);
  } else {
    Serial.print("ERROR V | Current: ERROR mA | Power: ERROR mW");
  }

  Serial.printf(" | Motion: %s | Effective motion: %s | PWM: %u/255\n",
                latestMotion ? "DETECTED" : "NONE",
                effectiveMotion ? "ACTIVE" : "INACTIVE",
                currentPwmDuty);
}

void runBlinkTest() {
  pinMode(ONBOARD_LED_PIN, OUTPUT);
  bool ledOn = false;

  Serial.println("ESP32 OK");
  while (true) {
    ledOn = !ledOn;
    digitalWrite(ONBOARD_LED_PIN, ledOn ? HIGH : LOW);
    Serial.println(ledOn ? "LED ON" : "LED OFF");
    delay(500);
  }
}

bool deviceFound(const uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void runI2CScan() {
  setupI2C();

  uint8_t deviceCount = 0;
  Serial.println("I2C scan starting...");
  for (uint8_t address = 1; address < 127; ++address) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      ++deviceCount;
      Serial.printf("I2C device found at 0x%02X\n", address);
    }
  }

  if (deviceCount == 0) {
    Serial.println("WARNING: no I2C devices found");
  }
  if (!deviceFound(BH1750_I2C_ADDRESS)) {
    Serial.println("WARNING: BH1750 missing at 0x23");
  }
  if (!deviceFound(INA219_I2C_ADDRESS)) {
    Serial.println("WARNING: INA219 missing at 0x40");
  }
}

void runSensorTest() {
  setupSensorsAndPwm();
  while (true) {
    const uint32_t now = millis();
    readSensors(now);
    applyAdaptiveLighting(now);
    printTelemetry();
    delay(TELEMETRY_INTERVAL_MS);
  }
}
}  // namespace

void setup() {
  setupSerial();

#if defined(TEST_MODE_BLINK)
  runBlinkTest();
#elif defined(TEST_MODE_I2C_SCAN)
  runI2CScan();
#elif defined(TEST_MODE_SENSORS)
  runSensorTest();
#else
  Serial.println("=== LIGHT-001 SENSOR AND PWM FIRMWARE ===");
  setupSensorsAndPwm();
  Serial.println("Adaptive Lighting enabled");
#endif
}

void loop() {
#if !defined(TEST_MODE_BLINK) && !defined(TEST_MODE_I2C_SCAN) && !defined(TEST_MODE_SENSORS)
  const uint32_t now = millis();
  readSensors(now);
  applyAdaptiveLighting(now);
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    printTelemetry();
  }
#endif
}