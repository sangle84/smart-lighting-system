#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

#define SDA_PIN 21
#define SCL_PIN 22

Adafruit_INA219 ina219;

void setup() {
    Serial.begin(115200);
    Wire.begin(SDA_PIN, SCL_PIN);

    Serial.println("\n=== INA219 TEST ===");

    if (!ina219.begin()) {
        Serial.println("ERROR: INA219 not detected!");
        while (true) {
            delay(1000);
        }
    }

    Serial.println("INA219 initialized successfully!");
}

void loop() {
    float busVoltage = ina219.getBusVoltage_V();
    float shuntVoltage = ina219.getShuntVoltage_mV();
    float current = ina219.getCurrent_mA();
    float power = ina219.getPower_mW();

    Serial.println("------------------------");

    Serial.print("Bus Voltage: ");
    Serial.print(busVoltage, 3);
    Serial.println(" V");

    Serial.print("Shunt Voltage: ");
    Serial.print(shuntVoltage, 3);
    Serial.println(" mV");

    Serial.print("Current: ");
    Serial.print(current, 3);
    Serial.println(" mA");

    Serial.print("Power: ");
    Serial.print(power, 3);
    Serial.println(" mW");

    delay(1000);
}
