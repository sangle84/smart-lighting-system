#include <Arduino.h>

#define RCWL_PIN 27

void setup() {
    Serial.begin(115200);
    pinMode(RCWL_PIN, INPUT);

    Serial.println("\n=== RCWL-0516 TEST ===");
}

void loop() {
    int motion = digitalRead(RCWL_PIN);

    if (motion == HIGH) {
        Serial.println("Motion detected!");
    } else {
        Serial.println("No motion");
    }

    delay(500);
}
