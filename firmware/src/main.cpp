#include <Arduino.h>
#include <Wire.h>

#include <Adafruit_INA219.h>
#include <BH1750.h>

namespace {
constexpr uint8_t LED_PIN = 2;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t MOTION_PIN = 19;
constexpr uint8_t PWM_PIN = 18;

constexpr uint8_t BH1750_ADDRESS = 0x23;
constexpr uint8_t INA219_I2C_ADDRESS = 0x40;
constexpr uint32_t PWM_FREQUENCY_HZ = 5000;
constexpr uint8_t PWM_RESOLUTION_BITS = 8;
constexpr uint32_t SENSOR_INTERVAL_MS = 1000;

BH1750 lightMeter(BH1750_ADDRESS);
Adafruit_INA219 ina219(INA219_I2C_ADDRESS);

bool deviceFound(uint8_t address);

void setupSerial() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
}

void setupI2C() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
}

void runBlinkTest() {
  pinMode(LED_PIN, OUTPUT);
  bool ledOn = false;

  Serial.println("ESP32 OK");
  while (true) {
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    Serial.println(ledOn ? "LED ON" : "LED OFF");
    delay(500);
  }
}

void runI2CScan() {
  setupI2C();

  uint8_t deviceCount = 0;
  Serial.println("I2C scan starting...");
  for (uint8_t address = 1; address < 127; ++address) {
    Wire.beginTransmission(address);
    const uint8_t error = Wire.endTransmission();
    if (error == 0) {
      ++deviceCount;
      Serial.printf("I2C device found at 0x%02X\n", address);
    }
  }

  if (deviceCount == 0) {
    Serial.println("WARNING: no I2C devices found");
  }
  if (!deviceFound(BH1750_ADDRESS)) {
    Serial.println("WARNING: BH1750 missing at 0x23");
  }
  if (!deviceFound(INA219_I2C_ADDRESS)) {
    Serial.println("WARNING: INA219 missing at 0x40");
  }
}

bool deviceFound(const uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void runSensorTest() {
  setupI2C();
  pinMode(MOTION_PIN, INPUT);

  const bool bh1750Ready = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!bh1750Ready) {
    Serial.println("ERROR: BH1750 initialization failed at 0x23");
  }

  const bool ina219Ready = ina219.begin();
  if (!ina219Ready) {
    Serial.println("ERROR: INA219 initialization failed at 0x40");
  }

  if (!bh1750Ready && !ina219Ready) {
    Serial.println("ERROR: no sensor initialized; continuing without sensor readings");
  }

  while (true) {
    if (bh1750Ready) {
      Serial.printf("lux=%.2f", lightMeter.readLightLevel());
    } else {
      Serial.print("lux=ERROR");
    }

    Serial.printf(" motion=%s", digitalRead(MOTION_PIN) == HIGH ? "true" : "false");

    if (ina219Ready) {
      Serial.printf(" bus_voltage=%.3f V current=%.2f mA power=%.2f mW\n",
                    ina219.getBusVoltage_V(), ina219.getCurrent_mA(), ina219.getPower_mW());
    } else {
      Serial.println(" bus_voltage=ERROR current=ERROR power=ERROR");
    }
    delay(SENSOR_INTERVAL_MS);
  }
}

uint8_t dutyFromPercent(const uint8_t percent) {
  return static_cast<uint8_t>((static_cast<uint16_t>(percent) * 255U) / 100U);
}

void runPwmTest() {
  // DO NOT RUN until the MOSFET wiring has been physically checked and confirmed.
  ledcAttach(PWM_PIN, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS);

  while (true) {
    for (uint8_t percent = 0; percent <= 100; ++percent) {
      ledcWrite(PWM_PIN, dutyFromPercent(percent));
      delay(20);
    }
    for (int percent = 99; percent >= 0; --percent) {
      ledcWrite(PWM_PIN, dutyFromPercent(static_cast<uint8_t>(percent)));
      delay(20);
    }
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
#elif defined(TEST_MODE_PWM)
  runPwmTest();
#else
  Serial.println("ERROR: no test mode selected");
#endif
}

void loop() {}