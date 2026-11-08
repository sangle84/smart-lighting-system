#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

namespace {
constexpr uint8_t PWM_PIN = 18;
constexpr uint8_t PWM_CHANNEL = 0;
constexpr uint32_t PWM_FREQUENCY_HZ = 5000;
constexpr uint8_t PWM_RESOLUTION_BITS = 8;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t INA219_I2C_ADDRESS = 0x40;
constexpr uint32_t RAMP_STEP_INTERVAL_MS = 20;
constexpr uint32_t HOLD_INTERVAL_MS = 3000;
constexpr uint32_t REPORT_INTERVAL_MS = 500;

Adafruit_INA219 ina219(INA219_I2C_ADDRESS);
bool ina219Ready = false;
uint8_t duty = 0;
bool rampingUp = true;
uint32_t lastStepAt = 0;
uint32_t lastReportAt = 0;
uint32_t holdStartedAt = 0;

void printTelemetry() {
  const float dutyPercent = (static_cast<float>(duty) * 100.0F) / 255.0F;

  Serial.printf("PWM: %.1f%% (%u/255)", dutyPercent, duty);
  if (ina219Ready) {
    Serial.printf(" | Bus: %.3f V | Current: %.3f mA | Power: %.3f mW\n",
                  ina219.getBusVoltage_V(), ina219.getCurrent_mA(), ina219.getPower_mW());
  } else {
    Serial.println(" | Bus: ERROR | Current: ERROR | Power: ERROR");
  }
}

void applyDuty(uint8_t nextDuty) {
  duty = nextDuty;
  ledcWriteChannel(PWM_CHANNEL, duty);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  Serial.println();
  Serial.println("=== PWM LED + INA219 TEST ===");
  Serial.println("WARNING: Run only after checking the 12V/MOSFET wiring.");

  if (!ledcAttachChannel(PWM_PIN, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS, PWM_CHANNEL)) {
    Serial.println("ERROR: PWM initialization failed!");
    while (true) {
      delay(1000);
    }
  }
  applyDuty(0);

  ina219Ready = ina219.begin();
  if (ina219Ready) {
    Serial.println("INA219 initialized successfully!");
  } else {
    Serial.println("ERROR: INA219 initialization failed; continuing with PWM only.");
  }

  lastStepAt = millis();
  lastReportAt = millis();
}

void loop() {
  const uint32_t now = millis();

  if (now - lastReportAt >= REPORT_INTERVAL_MS) {
    lastReportAt = now;
    printTelemetry();
  }

  if (rampingUp && duty < 255 && now - lastStepAt >= RAMP_STEP_INTERVAL_MS) {
    lastStepAt = now;
    applyDuty(static_cast<uint8_t>(duty + 1));
    if (duty == 255) {
      holdStartedAt = now;
    }
    return;
  }

  if (rampingUp && duty == 255) {
    if (now - holdStartedAt >= HOLD_INTERVAL_MS) {
      lastStepAt = now;
      rampingUp = false;
      applyDuty(255);
    }
    return;
  }

  if (!rampingUp && duty > 0 && now - lastStepAt >= RAMP_STEP_INTERVAL_MS) {
    lastStepAt = now;
    applyDuty(static_cast<uint8_t>(duty - 1));
    if (duty == 0) {
      holdStartedAt = now;
    }
    return;
  }

  if (!rampingUp && duty == 0 && now - holdStartedAt >= HOLD_INTERVAL_MS) {
    lastStepAt = now;
    rampingUp = true;
    applyDuty(1);
  }
}
