#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>

#define SDA_PIN 21
#define SCL_PIN 22

BH1750 lightMeter;

void setup() {
    Serial.begin(115200);

    Wire.begin(SDA_PIN, SCL_PIN);

    Serial.println("\n=== BH1750 TEST ===");

    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
        Serial.println("BH1750 initialized successfully!");
    } else {
        Serial.println("ERROR: BH1750 initialization failed!");
        while (true) {
            delay(1000);
        }
    }
}

void loop() {
    float lux = lightMeter.readLightLevel();

    Serial.print("Light: ");
    Serial.print(lux);
    Serial.println(" lx");

    delay(1000);
}
