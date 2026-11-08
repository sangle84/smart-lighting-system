# Test Results for Smart Lighting System

| TC | Description | Execution Method | Result | Notes |
|----|-------------|------------------|--------|-------|
| TC01 | RBAC login for Admin / Operator / Viewer | UI login flow | PASS | |
| TC02 | Create new device via API | `POST /devices` | PASS | |
| TC03 | Publish telemetry from simulated device | `mosquitto_pub` or mqtt‑simulator | PASS | |
| TC04 | Real‑time telemetry updates on dashboard | UI observation | PASS | |
| TC05 | Send PWM / ON / OFF commands | UI / API | PASS | |
| TC06 | Adaptive lighting reacts to sensor changes | Simulated sensor values | PASS | |
| TC07 | Device disconnect handling | Stop MQTT client | PASS | |
| TC08 | Generate Lamp Fault alert | Publish fault payload | PASS | |
| TC09 | Viewer attempts write command → 403 | UI as Viewer | PASS | |
| TC10 | Decommission device → broker rejects | Set lifecycle DECOMMISSIONED then publish | PASS | |

*Replace the placeholder results with the actual outcome after you run each test.*
